# 차계부 데이터 계약

- 날짜: 2026-11-05 · 소유자: API Designer · 티켓: MPR-19 · 상태: 초안(Software Architect 검토 대기)
- 근거: [02_architecture.md](../02_architecture.md) 6~8장, [ADR-003](../adr/003-linked-event-id-no-fk.md)·[004](../adr/004-carbook-category-deterministic-id.md)·[005](../adr/005-hide-carbook-from-share-partners-restrictive-rls.md), [03_spec.md](../03_spec.md) F-03~F-08
- **이 문서가 02_architecture 6장·8장과 다르면 이 문서가 우선한다.** 다른 곳은 8장에 모았다.
- 별도 서버가 없다. 계약은 ① Supabase 테이블 4개의 행 모양, ② `events` 연결 일정 행, ③ RPC 1개, ④ `data/*` 함수 시그니처, ⑤ `useCarbook` 인터페이스다. HTTP 엔드포인트를 새로 만들지 않으므로 `openapi.yaml`은 쓰지 않는다(`redocly lint` 대상 없음).
- 읽는 순서: Backend는 1~6장, Frontend는 6·7장(`useCarbook`과 mock)만 보면 병렬로 구현할 수 있다.

## 1. 공통 규칙

| 항목 | 규칙 |
|---|---|
| 클라이언트 | `src/lib/supabaseClient.ts`의 `supabase`. `null`이면 `data/*` 함수는 `{ kind: 'unknown', code: 'no_client' }`를 던진다(`useCarbook`은 로그인 뒤에만 불리므로 정상 흐름에선 없음) |
| 인증 | 로그인 세션의 JWT. 모든 접근은 RLS(`auth.uid() = user_id`)로 막는다. 권한 오류를 화면에 따로 보이지 않는다 |
| `user_id` | 차계부 4개 테이블은 보내지 않는다(DB 기본값 `auth.uid()`). **`events`만** 클라이언트가 `user_id`를 보낸다(기존 `eventToRow`와 같음, 기본값 없음) |
| 컬럼 선택 | 항상 열 이름을 나열해 읽는다(`select('*')` 금지). 쓰기는 `.select(열 목록)`으로 저장된 행을 돌려받는다(상태 갱신에 쓴다, NFR-03) |
| id | 새 행의 `id`는 클라이언트가 `crypto.randomUUID()`로 정해 보낸다. 연결 일정 id(`event_id`)도 같다. 행 id와 일정 id는 다르다(ADR-003) |
| 생성 질의 | 차량·기록·교체 항목은 `upsert(…, { onConflict: 'id' })`(같은 id 재시도가 중복을 만들지 않음). **만기일만 `insert`**(같은 차량·종류 두 번째 저장을 23505로 드러내기 위해) |
| 수정 질의 | 바꿀 수 있는 열을 **전부** 보낸다(부분 갱신 없음. 종류를 주유→세차로 바꾸면 `liters: null, full_tank: false`가 같이 가야 한다, BR-10). 0행이 바뀌면 `{ kind: 'unknown', code: 'not_found' }` |
| 삭제 질의 | 0행 삭제는 성공이다(멱등) |
| 빈 문자열 | `model`, `plate`, `memo`가 `''`이면 `null`로 보낸다 |
| 제한 시간 | 요청마다 20초(`TIMEOUT_MS = 20000`). `AbortController` + `setTimeout`을 쓰고 끝나면 `clearTimeout`(`AbortSignal.timeout`은 vitest 가짜 타이머에서 안 움직여서 바꿈) |
| 재시도 | 없다(NFR-39). 읽기 질의도 **`.retry(false)`를 붙인다**: `supabase-js` 2.116은 GET을 실패·503·520에서 최대 3번 자동 재시도하기 때문이다 |
| 읽기 쪽수 | PostgREST 기본 응답 상한은 1,000행이라 **목록 읽기는 1,000행씩 `.range()`로 이어 읽는다**(02_architecture 8.2의 "기록 최대 2,000행"이 한 번에 안 읽힘). 쪽마다 같은 정렬 끝에 `id`를 붙이고, 모은 뒤 `id`로 중복을 지운다 |
| 로그 | `console.error('[carbook]', 동작 이름, error.code)`만. 행 내용·번호판을 찍지 않는다(NFR-31) |
| 민감 필드 | 이 계약에 비밀번호·토큰은 없다. 번호판(`plate`)은 `vehicles` 행에만 있고 `events`의 제목·메모에 넣지 않는다(AC-08-10) |

### 1.1 오류 모양과 분류 (`data/request.ts`)

모든 `data/*` 함수는 실패하면 아래 객체를 **던진다**(`Error` 서브클래스 `CarbookError`, 필드는 같음).

```ts
export type CarbookErrorKind = 'timeout' | 'network' | 'conflict' | 'unknown'
export interface CarbookError { kind: CarbookErrorKind; code?: string }   // code = Postgres/PostgREST 코드 또는 아래 내부 코드
export const TIMEOUT_MS = 20000
export function request<T>(
  action: string,   // 로그용 동작 이름. 예: 'saveRecord'
  build: (signal: AbortSignal) => PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null; status?: number }>,
): Promise<T>        // error가 있으면 throw, 없으면 data(null이면 호출한 함수가 처리)
```

위에서부터 먼저 맞는 것을 쓴다.

| 순서 | 조건 | kind | code |
|---|---|---|---|
| 1 | 우리 `signal.aborted`가 참 | `timeout` | `error.code`(대개 빈 문자열) → 생략 |
| 2 | `error.code`가 `23505`(unique 위반) 또는 `23503`(참조 대상 없음) | `conflict` | 그 코드 |
| 3 | `status === 0`(요청이 서버에 닿지 못함, postgrest-js가 그렇게 돌려줌) 또는 `status >= 500` | `network` | `error.code` |
| 4 | 그 밖(`42501` RLS 거부, `23514` check 위반, `PGRST*`, JWT 만료 등) | `unknown` | `error.code` |

내부 코드(DB 코드와 안 겹침): `no_client`, `not_found`.
`useCarbook`의 반응은 6.3이다. 네 kind 모두 문구는 같고(쓰기 MSG-01, 삭제 MSG-03, 읽기 MSG-04) `conflict`만 다시 읽기를 더한다.

## 2. 테이블 행 모양과 domain 변환

`domain/types.ts` 타입은 02_architecture 6장 그대로다(바뀐 것 없음). 아래는 DB 쪽 JSON(행)과 변환 규칙이다. 변환은 `data/carbookApi.ts` 안에서만 한다(`supabaseRepository.ts`와 같은 방식). 나머지 코드는 snake_case를 모른다.

공통: JSON 숫자는 JS number, 날짜 열은 `date` 타입이라 `"YYYY-MM-DD"` 문자열, `created_at`은 DB가 주는 ISO 문자열을 **그대로** `createdAt`에 둔다(가공 금지). `null`은 `null`로 유지한다(`undefined`로 바꾸지 않음).

### 2.1 `vehicles` ↔ `Vehicle`

| 행 열 | 타입 | domain | 비고 |
|---|---|---|---|
| `id` | uuid | `id` | |
| `name` | text | `name` | 1~20자 |
| `model` | text \| null | `model` | |
| `year` | int \| null | `year` | |
| `plate` | text \| null | `plate` | |
| `odometer_km` | int \| null | `odometerKm` | |
| `created_at` | timestamptz | `createdAt` | |

보내는 열(`VehicleInput` → 행): `name, model, year, plate, odometer_km`.

### 2.2 `car_records` ↔ `CarRecord`

| 행 열 | 타입 | domain | 비고 |
|---|---|---|---|
| `id` | uuid | `id` | |
| `vehicle_id` | uuid | `vehicleId` | |
| `kind` | text | `kind` | `fuel`·`maintenance`·`wash`·`insurance`·`tax`·`parking`·`other` |
| `date` | date | `date` | `YYYY-MM-DD` |
| `amount_won` | int | `amountWon` | |
| `odometer_km` | int \| null | `odometerKm` | |
| `liters` | numeric(6,2) \| null | `liters` | JSON 숫자(`38.45`). 문자열이 아님 |
| `full_tank` | boolean | `fullTank` | 기본 `false` |
| `memo` | text \| null | `memo` | |
| `created_at` | timestamptz | `createdAt` | |

보내는 열: `vehicle_id`(생성만), `kind, date, amount_won, odometer_km, liters, full_tank, memo`. **`kind !== 'fuel'`이면 `liters: null, full_tank: false`로 보낸다**(`RecordInput`이 이미 그렇게 와야 하지만 `toRow`가 한 번 더 강제한다, BR-10).

### 2.3 `car_maintenance_items` ↔ `MaintenanceItem`

| 행 열 | 타입 | domain | 비고 |
|---|---|---|---|
| `id` | uuid | `id` | |
| `vehicle_id` | uuid | `vehicleId` | |
| `name` | text | `name` | 1~30자 |
| `interval_km` | int \| null | `intervalKm` | `interval_km`·`interval_months` 중 하나 이상 |
| `interval_months` | int \| null | `intervalMonths` | |
| `last_date` | date | `lastDate` | |
| `last_odometer_km` | int \| null | `lastOdometerKm` | 주행거리 없는 차량의 추천 항목은 `null`(BR-06a) |
| `event_id` | uuid \| null | `eventId` | FK 없음(ADR-003) |
| `created_at` | timestamptz | `createdAt` | |

보내는 열: 생성 `vehicle_id, name, interval_km, interval_months, last_date, last_odometer_km, event_id`. **수정은 `event_id`를 보내지 않는다**(`name … last_odometer_km`만). `event_id`는 3장의 `claim`으로만 처음 채운다. `event_id`는 `ItemInput`에 없으므로 `data` 쪽 생성 입력 타입을 둔다.

```ts
export type ItemRowInput = ItemInput & { eventId: string | null }   // 생성(createItems) 전용. 수정은 ItemInput만
```

### 2.4 `car_due_dates` ↔ `DueDate`

| 행 열 | 타입 | domain | 비고 |
|---|---|---|---|
| `id` | uuid | `id` | |
| `vehicle_id` | uuid | `vehicleId` | |
| `kind` | text | `kind` | `insurance`·`car_tax`·`inspection`. (`vehicle_id`, `kind`) unique |
| `due_date` | date | `dueDate` | |
| `event_id` | uuid \| null | `eventId` | |
| `created_at` | timestamptz | `createdAt` | |

보내는 열: `vehicle_id, kind`(생성만), `due_date, event_id`.

## 3. 질의: `data/carbookApi.ts`

모든 함수는 `request()`를 거치고 실패하면 1.1의 오류를 던진다. 읽기는 `.retry(false)`, 목록은 1,000행씩 이어 읽는다. `COLS`는 2장 표의 열 전부(`user_id` 제외).

```ts
// 읽기 (RLS가 본인 행만 돌려준다. user_id 조건을 따로 붙이지 않는다)
export function listVehicles(): Promise<Vehicle[]>               // order created_at asc, id asc
export function listItems(): Promise<MaintenanceItem[]>          // 사용자 전체. order created_at asc, id asc
export function listDueDates(): Promise<DueDate[]>               // 사용자 전체. order created_at asc, id asc
export function listRecords(vehicleId: string): Promise<CarRecord[]>   // eq vehicle_id. order date desc, created_at desc, id desc

// 차량
export function createVehicle(id: string, input: VehicleInput): Promise<Vehicle>      // upsert onConflict id
export function updateVehicle(id: string, input: VehicleInput): Promise<Vehicle>      // update eq id, 0행이면 not_found
export function deleteVehicle(id: string): Promise<void>                              // delete eq id (딸린 행은 cascade)

// 기록
export function createRecord(id: string, vehicleId: string, input: RecordInput): Promise<CarRecord>
export function updateRecord(id: string, input: RecordInput): Promise<CarRecord>
export function deleteRecord(id: string): Promise<void>

// 교체 항목
export function createItems(vehicleId: string, rows: Array<{ id: string } & ItemRowInput>): Promise<MaintenanceItem[]>  // 한 번의 upsert(추천 7행 포함)
export function updateItem(id: string, input: ItemInput, claimEventId?: string): Promise<MaintenanceItem>   // 3장 규칙 'event_id 선점'
export function fillMissingItemOdometer(vehicleId: string, odometerKm: number): Promise<MaintenanceItem[]>  // BR-06a. 바뀐 행만 돌려줌([]이면 바뀐 것 없음)
export function deleteItem(id: string): Promise<void>

// 만기일
export function createDueDate(row: { id: string; vehicleId: string; kind: DueKind; dueDate: DateKey; eventId: string }): Promise<DueDate>   // insert (upsert 아님)
export function updateDueDate(id: string, dueDate: DateKey, claimEventId?: string): Promise<DueDate>   // 같은 '선점' 규칙
export function deleteDueDate(id: string): Promise<void>

// 연결 해제 (차량 삭제 중 일정을 지울 때마다 호출, BR-22)
export function clearEventId(table: 'item' | 'due', id: string): Promise<void>   // event_id = null
```

질의 대응(supabase-js 기준, `T` = 테이블 이름).

| 함수 | 질의 |
|---|---|
| `list*` | `from(T).select(COLS).order(…).range(from, from + 999)`을 한 쪽이 1,000행 미만일 때까지 반복 |
| `create{Vehicle,Record}` / `createItems` | `from(T).upsert(rows, { onConflict: 'id' }).select(COLS)` (`createItems`는 배열, 나머지는 `.single()`) |
| `createDueDate` | `from('car_due_dates').insert(row).select(COLS).single()` |
| `update{Vehicle,Record}` | `from(T).update(cols).eq('id', id).select(COLS).maybeSingle()` |
| `updateItem` / `updateDueDate` | ① `claimEventId`가 있으면 `from(T).update({ event_id: claimEventId }).eq('id', id).is('event_id', null)` (결과 행 수는 보지 않음) ② `from(T).update(cols).eq('id', id).select(COLS).maybeSingle()` — `cols`에 `event_id`를 넣지 않는다. 돌려받은 행의 `eventId`가 정본이다 |
| `delete*` | `from(T).delete().eq('id', id)` |
| `fillMissingItemOdometer` | `from('car_maintenance_items').update({ last_odometer_km: km }).eq('vehicle_id', vehicleId).is('last_odometer_km', null).select(COLS)` |
| `clearEventId` | `from(T).update({ event_id: null }).eq('id', id)` |

규칙
- **`event_id` 선점(F-1, AC-08-13)**: `event_id`가 `null`인 항목·만기일을 두 탭이 동시에 저장해도 일정이 1건이게 하는 규칙이다. `useCarbook`은 상태의 `eventId`가 `null`일 때만 새 uuid를 만들어 `claimEventId`로 넘긴다(이미 있으면 넘기지 않는다). `update*`는 ①에서 `event_id is null`일 때만 그 uuid를 쓰고(먼저 쓴 탭이 이긴다), ②에서 나머지 열을 갱신하며 **돌려받은 행의 `event_id`**를 정본으로 돌려준다. 진 탭의 uuid는 어디에도 쓰이지 않으므로 고아 일정이 생기지 않는다. 호출한 쪽은 반드시 돌려받은 행의 `eventId`로 `syncEvent`를 한다(자기가 만든 uuid로 하지 않는다). ①만 성공하고 ②가 실패하면 `event_id`는 채워지고 나머지 열은 그대로다. 사용자는 MSG-01을 보고 다시 저장하면 되고(①은 0행, ②가 진행), 그 사이 열 때 점검(6.4)이 일정을 만들어도 같은 id라 중복이 없다.
- `createItems`는 행마다 `created_at`을 **1ms씩 늘려 직접 보낸다**(`base + i`ms). 추천 7행을 한 문장으로 넣으면 `created_at`이 모두 같아, `created_at asc` 정렬만으로는 BR-06 순서(엔진오일 먼저)가 안 지켜지기 때문이다. 보내는 순서가 곧 목록 순서다.
- 차량 추가의 보상 삭제(`deleteVehicle`)는 `useCarbook`이 부른다. 보상도 실패하면 그 오류는 삼키고(로그만), 사용자에게는 MSG-01만 보인다. 이 경우 항목이 없는 차량이 남을 수 있다 — 알려진 한계(8.2).
- 정렬 기준은 모든 목록에서 `created_at` 다음에 `id`를 끝 기준으로 붙인다(위 `order` 표기 그대로). 추천 7행은 클라이언트 시각, 그 밖의 행은 서버 `now()`라 시계가 어긋나면 서로 섞여 보일 수 있으나, 같은 시각 안에서는 `id`로 결정적이다. 어긋남 자체는 받아들인다(1인 사용, 추천 7행끼리의 순서는 1ms 간격으로 항상 지켜짐).
- 읽기 쪽수 때문에 목록 읽는 동안 다른 탭이 행을 넣거나 지우면 한 행이 중복되거나 빠질 수 있다. `id` 중복 제거 후 그대로 쓴다(1인 사용, 다음 읽기에서 맞춰짐).

## 4. 연결 일정: `data/calendarLink.ts`

### 4.1 `events` 행 모양 (기존 테이블, 변경 없음)

연결 일정은 기존 `eventToRow`와 같은 열로 쓴다. 차계부가 만드는 행은 항상 이 모양이다.

```json
{
  "id": "e1f0c5a2-6c1b-4e0e-9b38-2a6f0d9a7b11",
  "user_id": "5b0d3c7e-1a22-4f4b-8c0e-7d1d2f6a9c33",
  "title": "[내 차] 엔진오일 교체 예정",
  "memo": null,
  "category_id": "9a1c2b3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d",
  "color": null,
  "all_day": true,
  "start_at": "2027-05-01",
  "end_at": "2027-05-01",
  "recurrence": null,
  "excluded_dates": null
}
```

- `id` = 항목·만기일 행의 `event_id`. `user_id` = 로그인 사용자. `category_id` = `ensure_carbook_category()`가 준 id.
- `start_at`/`end_at`은 `text`, 종일 일정이라 `YYYY-MM-DD` 둘이 같다(`supabase/schema.sql`).
- `title`은 도메인(`domain/titles.ts`)이 만들어 넘긴다. 번호판 금지. `memo`는 항상 `null`.

### 4.2 함수

팩토리를 쓴다. 이유: 카테고리 id를 "화면 수명 동안 기억"(ADR-004)해야 하고 모든 `events` 질의에 `userId`가 필요해서다.

```ts
export interface LinkedEventSpec { eventId: string; title: string; date: DateKey }   // 계산된 값(원천, BR-25)
export interface ExistingEvent { id: string; title: string; start_at: string; category_id: string | null }

export interface CalendarLink {
  ensureCategoryId(): Promise<string>                                  // RPC 한 번, 결과를 기억. 5장
  fetchEvents(ids: string[]): Promise<Map<string, ExistingEvent>>      // 100개씩 나눠 조회. 없는 id는 Map에 없음
  syncEvent(spec: LinkedEventSpec, known?: ExistingEvent | null): Promise<'written' | 'unchanged'>
  deleteEvent(eventId: string): Promise<boolean>                       // 지웠으면 true, 원래 없었으면 false
  rebindCategory(eventIds: string[]): Promise<void>                    // 100개씩 category_id 갱신
}
export function createCalendarLink(userId: string): CalendarLink
```

| 함수 | 동작 |
|---|---|
| `ensureCategoryId` | `supabase.rpc('ensure_carbook_category')` → uuid 문자열. 성공하면 기억하고 이후엔 RPC를 다시 부르지 않는다. 동시에 여러 번 불려도 진행 중인 약속(Promise) 하나를 공유한다 |
| `fetchEvents` | 100개씩: `from('events').select('id,title,start_at,category_id').eq('user_id', userId).in('id', chunk).retry(false)` |
| `syncEvent` | ① `ensureCategoryId()` ② `known === undefined`이면 `fetchEvents([eventId])`로 읽고, `null`이면 "없음", 객체면 그 값을 쓴다 ③ 있고 `title`·`start_at`·`category_id`가 `spec.title`·`spec.date`·카테고리 id와 **모두 같으면** 쓰지 않고 `'unchanged'` ④ 아니면 4.1의 행 전체를 `from('events').upsert(row, { onConflict: 'id' })`(BR-25 덮어쓰기) → `'written'` |
| `deleteEvent` | `from('events').delete().eq('id', eventId).eq('user_id', userId).select('id')` → 돌려받은 행이 있으면 `true` |
| `rebindCategory` | `ensureCategoryId()` 후 100개씩 `from('events').update({ category_id }).eq('user_id', userId).in('id', chunk)` |

규칙
- `syncEvent`가 `category_id` 때문에 `23503`(카테고리가 그새 지워짐)을 받으면 기억한 카테고리 id를 버리고 `ensureCategoryId()`를 다시 불러 **한 번만** 다시 쓴다. 다시 실패하면 그 오류를 던진다.
- 일정 쓰기·삭제가 하나라도 실제로 일어났는지(`'written'`, `deleteEvent === true`, `rebindCategory`로 1건 이상 갱신)를 `useCarbook`이 모아 끝에 `reload()`를 한 번 부른다(ADR-002).
- 조회·재묶기·삭제는 모두 `eq('user_id', userId)`를 붙인다(공유받은 남의 일정에 닿지 않게).
- `in('id', …)` 한 번에 100개: 주소 길이는 약 4KB로 서버 한도 안이다(postgrest-js 경고 기준 8,000자).

## 5. RPC `ensure_carbook_category()`

사용자별 고정 id의 '차계부' 카테고리를 보장한다(ADR-004). 클라이언트는 id 식을 직접 계산하지 않는다.

| 항목 | 내용 |
|---|---|
| 호출 | `supabase.rpc('ensure_carbook_category').abortSignal(signal)` (인자 없음, POST) |
| 성공 | HTTP 200, 본문은 **uuid 문자열 하나**(`"9a1c2b3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d"`). `data`가 문자열이 아니면 `{ kind: 'unknown', code: 'bad_response' }` |
| 멱등 | 몇 번 불러도, 두 탭이 동시에 불러도 같은 id, 카테고리 1개. 이미 있으면 이름·색을 바꿨어도 건드리지 않는다 |
| 지웠다면 | 사용자가 카테고리를 지운 뒤 부르면 **같은 id로 다시 만든다**(`name: '차계부'`, `color: '#0f9d58'`) |
| 오류 | 로그인 안 됨(`auth.uid()`가 null) 등 모든 실패는 HTTP 4xx/5xx + PostgREST 오류 본문. 클라이언트는 1.1 표로 분류하고 코드별로 갈라 처리하지 않는다 |
| 권한 요구 | `authenticated`만 실행(`anon`·`public` 실행 권한 회수). `security invoker`, 새 파일 `supabase/schema_carbook.sql`(ADR-004) |

실패하면 이번 일정 쓰기 전체가 반영 실패다. 행 저장은 유지하고 그 행에 `calendarFailed = true`(MSG-11, 6.3).

## 6. `useCarbook` 인터페이스 (확정)

`state/useCarbook.ts`. `CarbookApp`이 `userId`가 있을 때만 호출한다. 02_architecture 6장에서 바뀐 곳은 `retryRecords` 하나가 늘어난 것이다.

```ts
export function useCarbook(userId: string): {
  loadState: 'loading' | 'ready' | 'error'    // error → 화면이 MSG-04 + "다시 시도"(retryLoad)
  retryLoad(): void
  vehicles: Vehicle[]                          // created_at 오름차순
  selectedVehicleId: string | null             // 기본: 가장 먼저 만든 차량. 차량 0대면 null
  selectVehicle(id: string): void
  recordsState: 'loading' | 'ready' | 'error'  // 선택 차량의 기록. error → MSG-04 + "다시 시도"(retryRecords)
  retryRecords(): void                         // [추가] 기록 읽기만 다시. loadState가 ready일 때도 필요
  records: CarRecord[]                         // 날짜 내림차순, 같은 날은 created_at 내림차순(BR-09)
  currentOdometerKm: number                    // BR-07
  items: ItemView[]                            // 선택 차량, created_at 오름차순
  dueDates: DueDateView[]                      // 선택 차량
  economy: EconomySegment[]                    // BR-11, 구간 끝 날짜 오름차순
  saveVehicle(input: VehicleInput, id?: string): Promise<boolean>   // id 없음 = 추가
  deleteVehicle(id: string): Promise<boolean>
  saveRecord(input: RecordInput, id?: string): Promise<boolean>
  deleteRecord(id: string): Promise<boolean>
  saveItem(input: ItemInput, id?: string): Promise<boolean>
  completeItem(id: string, done: { date: DateKey; odometerKm: number | null }): Promise<boolean>
  deleteItem(id: string): Promise<boolean>
  saveDueDate(kind: DueKind, dueDate: DateKey): Promise<boolean>    // 종류당 1개: 있으면 수정, 없으면 추가
  deleteDueDate(kind: DueKind): Promise<boolean>
  retryCalendar(target: { type: 'item' | 'due'; id: string }): Promise<void>
}
```

### 6.1 반환값과 상태 규칙

- 쓰기 함수의 `true` = **행 저장 성공**. 캘린더 쓰기가 실패해도 `true`이고 그 행의 `calendarFailed`가 `true`가 된다(토스트 없음). `false`면 상태를 바꾸지 않고 토스트(쓰기 MSG-01, 삭제 MSG-03)는 `useCarbook`이 띄운다. 화면은 `false`면 양식을 닫지 않는다(BR-27).
- 같은 대상의 쓰기가 진행 중이면 두 번째 호출은 요청 없이 `false`, 토스트 없음. 대상 키: `vehicle:{id}`, `record:{id}`, `item:{id}`, `due:{vehicleId}:{kind}`, 추가는 `create:{vehicle|record|item}`.
- 낙관적 갱신이 없다. 쓰기 성공 응답의 행으로 상태를 바꾼다(다시 읽기 없음).
- `saveVehicle`(추가)는 성공하면 그 차량을 선택한다. `deleteVehicle`은 선택 차량이었으면 남은 차량 중 가장 먼저 만든 차량(없으면 `null`)을 선택한다.
- 새 id(`create*`)는 호출마다 `crypto.randomUUID()`로 만든다. 같은 입력의 재시도가 `timeout`이었다면 서버에는 이미 저장됐을 수 있고, 다시 저장하면 기록이 두 건이 될 수 있다(8.2).
- `calendarFailed`는 메모리 상태만이다. 다시 열면 열 때 점검이 다시 시도한다.

### 6.2 동작 → 호출 순서 (`useCarbook`이 부르는 `data/*`)

02_architecture 8.3을 함수 이름으로 옮긴 것이다. 순서와 실패 처리는 8.3과 같다.

| 동작 | 순서 |
|---|---|
| 처음 읽기 | `Promise.all([listVehicles, listItems, listDueDates])` → 선택 차량이 정해지면 `listRecords(id)` → 화면 그림 → 열 때 점검(6.4) |
| 차량 추가 | `createVehicle` → `createItems(추천 7행, event_id: null)` → 둘째가 실패하면 `deleteVehicle`(보상) 후 `false` |
| 차량 수정 | `updateVehicle` → 별칭·주행거리가 바뀌었으면 (주행거리가 처음 생겼으면 `fillMissingItemOdometer`) → `event_id` 있는 항목·만기일 `syncEvent` |
| 기록 저장·삭제 | `createRecord`/`updateRecord`/`deleteRecord` → 첫 주행거리면 `fillMissingItemOdometer(vehicleId, 값)` → `event_id` 있는 km 항목 `syncEvent` |
| 항목 저장·교체 완료 | 새 항목: 새 uuid → `createItems`(그 `eventId` 포함). 기존 항목: 상태의 `eventId`가 `null`이면 새 uuid를 `claimEventId`로 넘겨 `updateItem` → **돌려받은 행의 `eventId`**로, 날짜 있음 `syncEvent` / 없음 `deleteEvent`(`event_id` 유지) |
| 만기일 저장 | 없던 종류: 새 uuid → `createDueDate` → `syncEvent`. 있던 종류: 상태의 `eventId`가 `null`이면 새 uuid를 `claimEventId`로 넘겨 `updateDueDate` → 돌려받은 행의 `eventId`로 `syncEvent` |
| 항목·만기일 삭제 | `event_id` 있으면 `deleteEvent` → 성공하면 `deleteItem`/`deleteDueDate`. `deleteEvent`가 실패하면 행 유지, `false` |
| 차량 삭제 | 연결된 항목·만기일마다 `deleteEvent` → `clearEventId`; 하나라도 실패하면 멈추고 `false` → 모두 성공하면 `deleteVehicle` |
| 캘린더 재시도 | `retryCalendar` = 그 행의 `syncEvent`만 다시. 성공하면 `calendarFailed = false` |

### 6.3 오류 → 반응

| kind | 쓰기·삭제 | 읽기 |
|---|---|---|
| `timeout` / `network` / `unknown` | `false` + MSG-01(삭제 MSG-03). 상태 불변 | `loadState`/`recordsState = 'error'` |
| `conflict` | 위와 같음 + 다시 읽기: `car_due_dates`의 `23505`면 그 사용자 만기일 목록을 `listDueDates`로 다시 읽는다. `23503`이면(다른 탭에서 차량이 지워짐) `retryLoad()`와 같게 처음 읽기를 다시 한다 | (읽기에선 안 생김) |
| 캘린더 쓰기 실패(`syncEvent`·`deleteEvent`·RPC) | 행 저장은 유지, `calendarFailed = true`, 토스트 없음. 단 **삭제 순서의 `deleteEvent` 실패는 쓰기 실패가 아니라 삭제 실패**(MSG-03, 행 유지) | — |
| 캘린더 `reload()` 실패 | 무시(60초 폴링이 보정) | — |

### 6.4 열 때 점검 (AC-08-3, AC-08-14)

1. `event_id`가 있는 항목·만기일의 id를 모아 `fetchEvents`(100개씩).
2. `category_id`가 `ensureCategoryId()`와 다른 일정을 모아 `rebindCategory`.
3. `fetchEvents`에 없는 id → 날짜를 계산할 수 있으면 `syncEvent(spec, null)`(만기일은 항상, 교체 항목은 그 차량 기록을 읽은 뒤). 계산 불가면 건너뜀.
4. 실패한 행은 `calendarFailed = true`. 점검은 행마다 같은 화면 수명에 한 번.
5. 일정 쓰기·재묶기가 1건 이상 실제로 일어났으면 끝에 `reload()` 한 번.

## 7. mock 예시 (Frontend용)

Frontend는 31~37 티켓에서 `useCarbook`을 아래 값으로 모의한다. 숫자는 03_spec의 AC-05-1·AC-06-2와 맞췄다(오늘 `2026-11-05`).

### 7.1 `useCarbook` 반환값 (성공, 차량 1대)

```json
{
  "loadState": "ready",
  "vehicles": [
    { "id": "11111111-aaaa-4aaa-8aaa-000000000001", "name": "출퇴근", "model": "아반떼 CN7", "year": 2022, "plate": "12가3456", "odometerKm": 10500, "createdAt": "2026-05-01T01:00:00.000000+00:00" }
  ],
  "selectedVehicleId": "11111111-aaaa-4aaa-8aaa-000000000001",
  "recordsState": "ready",
  "records": [
    { "id": "22222222-bbbb-4bbb-8bbb-000000000003", "vehicleId": "11111111-aaaa-4aaa-8aaa-000000000001", "kind": "fuel", "date": "2026-10-20", "amountWon": 52000, "odometerKm": 10500, "liters": 30, "fullTank": true, "memo": "고속도로 주유소", "createdAt": "2026-10-20T09:10:00.000000+00:00" },
    { "id": "22222222-bbbb-4bbb-8bbb-000000000002", "vehicleId": "11111111-aaaa-4aaa-8aaa-000000000001", "kind": "fuel", "date": "2026-10-10", "amountWon": 34000, "odometerKm": null, "liters": 20, "fullTank": false, "memo": null, "createdAt": "2026-10-10T09:00:00.000000+00:00" },
    { "id": "22222222-bbbb-4bbb-8bbb-000000000001", "vehicleId": "11111111-aaaa-4aaa-8aaa-000000000001", "kind": "fuel", "date": "2026-10-01", "amountWon": 65000, "odometerKm": 10000, "liters": null, "fullTank": true, "memo": null, "createdAt": "2026-10-01T08:30:00.000000+00:00" }
  ],
  "currentOdometerKm": 10500,
  "items": [
    { "id": "33333333-cccc-4ccc-8ccc-000000000001", "vehicleId": "11111111-aaaa-4aaa-8aaa-000000000001", "name": "엔진오일", "intervalKm": 10000, "intervalMonths": 12, "lastDate": "2026-05-01", "lastOdometerKm": 10000, "eventId": "e1f0c5a2-6c1b-4e0e-9b38-2a6f0d9a7b11", "createdAt": "2026-05-01T01:00:00.000000+00:00", "nextDate": "2027-05-01", "remainingKm": 9500, "status": "ok", "calendarFailed": false },
    { "id": "33333333-cccc-4ccc-8ccc-000000000002", "vehicleId": "11111111-aaaa-4aaa-8aaa-000000000001", "name": "와이퍼", "intervalKm": null, "intervalMonths": 12, "lastDate": "2025-10-01", "lastOdometerKm": null, "eventId": null, "createdAt": "2026-05-01T01:00:00.001000+00:00", "nextDate": "2026-10-01", "remainingKm": null, "status": "overdue", "calendarFailed": false }
  ],
  "dueDates": [
    { "id": "44444444-dddd-4ddd-8ddd-000000000001", "vehicleId": "11111111-aaaa-4aaa-8aaa-000000000001", "kind": "insurance", "dueDate": "2027-03-10", "eventId": "e1f0c5a2-6c1b-4e0e-9b38-2a6f0d9a7b22", "createdAt": "2026-06-01T01:00:00.000000+00:00", "calendarFailed": true }
  ],
  "economy": [ { "endRecordId": "22222222-bbbb-4bbb-8bbb-000000000003", "endDate": "2026-10-20", "kmPerL": 10 } ]
}
```

위 값이 보여 주는 상태: 가득 A(10,000km)·비가득 20L·가득 B(10,500km, 30L)로 AC-05-1의 연비 10.0이 된다(A의 주유량은 구간에 들어가지 않아 `null`이어도 된다). 와이퍼는 `eventId: null`(추천 항목, 일정 없음), 보험 만기일은 `calendarFailed: true`(MSG-11 버튼이 보여야 하는 상태).

### 7.2 상태 변형

| 상태 | 값 |
|---|---|
| 로딩 | `{ "loadState": "loading", "vehicles": [], "selectedVehicleId": null, "recordsState": "loading", "records": [], "currentOdometerKm": 0, "items": [], "dueDates": [], "economy": [] }` |
| 읽기 실패 | 위에서 `"loadState": "error"` (MSG-04 + 다시 시도) |
| 기록만 실패 | 7.1에서 `"recordsState": "error"`, `"records": []` |
| 차량 0대 | `{ "loadState": "ready", "vehicles": [], "selectedVehicleId": null, "recordsState": "ready", "records": [], "currentOdometerKm": 0, "items": [], "dueDates": [], "economy": [] }` |

쓰기 함수 mock: 성공 `Promise.resolve(true)`, 실패 `Promise.resolve(false)`.

### 7.3 DB 행과 `data/*` 응답 (Backend 테스트용)

차량 한 행(`listVehicles` 응답 요소):

```json
{ "id": "11111111-aaaa-4aaa-8aaa-000000000001", "name": "출퇴근", "model": "아반떼 CN7", "year": 2022, "plate": "12가3456", "odometer_km": 10500, "created_at": "2026-05-01T01:00:00.000000+00:00" }
```

기록 한 행(`createRecord` 응답):

```json
{ "id": "22222222-bbbb-4bbb-8bbb-000000000003", "vehicle_id": "11111111-aaaa-4aaa-8aaa-000000000001", "kind": "fuel", "date": "2026-10-20", "amount_won": 52000, "odometer_km": 10500, "liters": 30, "full_tank": true, "memo": "고속도로 주유소", "created_at": "2026-10-20T09:10:00.000000+00:00" }
```

교체 항목 한 행: `{ "id": "33333333-cccc-4ccc-8ccc-000000000001", "vehicle_id": "11111111-aaaa-4aaa-8aaa-000000000001", "name": "엔진오일", "interval_km": 10000, "interval_months": 12, "last_date": "2026-05-01", "last_odometer_km": 10000, "event_id": "e1f0c5a2-6c1b-4e0e-9b38-2a6f0d9a7b11", "created_at": "2026-05-01T01:00:00.000000+00:00" }`

만기일 한 행: `{ "id": "44444444-dddd-4ddd-8ddd-000000000001", "vehicle_id": "11111111-aaaa-4aaa-8aaa-000000000001", "kind": "insurance", "due_date": "2027-03-10", "event_id": "e1f0c5a2-6c1b-4e0e-9b38-2a6f0d9a7b22", "created_at": "2026-06-01T01:00:00.000000+00:00" }`

오류 응답(supabase-js가 돌려주는 `{ data: null, error, status }`)과 분류 결과:

| 상황 | supabase-js 응답 | 던지는 값 |
|---|---|---|
| 20초 초과 | `{ error: { code: "", message: "AbortError: …" }, status: 0 }`, 우리 `signal.aborted === true` | `{ kind: 'timeout' }` |
| 연결 끊김 | `{ error: { code: "", message: "TypeError: Failed to fetch" }, status: 0 }` | `{ kind: 'network', code: '' }` |
| 서버 오류 | `{ error: { code: "XX000", message: "…" }, status: 500 }` | `{ kind: 'network', code: 'XX000' }` |
| 만기일 중복 | `{ error: { code: "23505", message: "duplicate key value violates unique constraint …" }, status: 409 }` | `{ kind: 'conflict', code: '23505' }` |
| RLS 거부 | `{ error: { code: "42501", message: "new row violates row-level security policy …" }, status: 403 }` | `{ kind: 'unknown', code: '42501' }` |
| 수정 대상 없음 | `{ data: null, error: null }` (`maybeSingle`) | `{ kind: 'unknown', code: 'not_found' }` |

RPC 성공 mock: `{ "data": "9a1c2b3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d", "error": null, "status": 200 }`.

## 8. 02_architecture와 다른 점 (Software Architect 확인 요청)

| # | 02_architecture | 이 계약 | 이유 |
|---|---|---|---|
| 1 | 8.2 기록 "전체 읽기, 최대 2,000행" | 1,000행씩 `.range()`로 이어 읽음 | Supabase PostgREST 기본 상한이 1,000행이라 한 번에는 1,000행에서 조용히 잘림(오류 없음). 기록 1,000건 넘는 사용자의 현재 주행거리·연비가 틀려짐. 프로젝트의 Max Rows 설정은 확인하지 못했다 |
| 2 | 8.5 "자동 재시도 없음" | 읽기에도 `.retry(false)`를 명시 | `supabase-js` 2.116 postgrest-js는 GET을 3번까지 자동 재시도(`node_modules/@supabase/postgrest-js/dist/index.mjs:63`·`:179`). 그대로 두면 NFR-39와 어긋남 |
| 3 | 8.5 `AbortSignal.timeout(20000)` | `AbortController` + `setTimeout` | vitest 가짜 타이머에서 `AbortSignal.timeout`은 안 움직여 timeout 테스트가 불가능 |
| 4 | 8.5 `conflict` = `23505` | `conflict` = `23505` 또는 `23503` | 다른 탭에서 차량이 지워진 뒤의 쓰기(FK)와 카테고리가 그새 지워진 일정 쓰기(FK)를 구분해 처리해야 함(6.3, 4.2) |
| 5 | 8.3 "추천 항목 7행 한 번에 insert" | 한 번의 upsert지만 행마다 `created_at`을 1ms씩 늘려 보냄 | 한 문장으로 넣으면 `created_at`이 같아 목록 순서(BR-06 엔진오일 먼저)가 보장되지 않음 |
| 6 | 6장 `useCarbook`에 `retryRecords` 없음 | `retryRecords()` 추가 | `recordsState === 'error'`는 `loadState`가 `ready`인 채로 생기므로 "다시 시도"가 따로 필요(F-04) |
| 7 | 6장이 `data/*`를 "함수"로만 언급 | `createCalendarLink(userId)` 팩토리, 나머지는 단순 함수 | 카테고리 id 기억(ADR-004)과 `userId` 필요. `carbookApi`는 상태가 없어 팩토리가 필요 없음 |
| 8 | 8.3 생성 | 차량·기록·항목은 `upsert`, 만기일만 `insert` | 같은 id 재시도가 중복을 만들지 않게(NFR-34). 만기일은 두 탭 충돌을 드러내야 해서 `insert`(8.5의 23505 처리와 일치) |
| 9 | 8.3 "`event_id`가 없으면 새 uuid를 정해 행과 함께 저장" | `event_id`가 `null`인 기존 행은 `event_id is null` 조건으로 먼저 선점하고, 수정 질의는 `event_id`를 쓰지 않으며, 돌려받은 행의 `event_id`로 `syncEvent` (3장 규칙) | 두 탭이 같은 항목을 동시에 첫 저장하면 일정이 2건이고 한쪽이 고아가 되는 구멍(QA F-1, AC-08-13). 만기일 `updateDueDate`도 `clearEventId` 부분 실패로 `event_id`가 `null`이 될 수 있어 같은 규칙 |

### 8.1 DB에 바라는 것 (Database Engineer에게 전달 필요)

내가 DB Engineer에게 직접 보낼 수 없어서 Software Architect가 MPR-17·18 담당에게 전해 주세요.

- `liters`는 `numeric(6,2)`(PostgREST가 JSON 숫자로 돌려줌), `date`·`due_date`는 `date`, `*_km`·`amount_won`은 `integer`(JSON 숫자), `created_at`은 `timestamptz`.
- `created_at`은 INSERT에서 클라이언트가 보낸 값을 받아야 한다(기본값만 `now()`). 5번(추천 7행 순서) 때문이다.
- 4개 테이블에 `user_id` 기본값 `auth.uid()`, insert·update 정책 `with check`.
- `ensure_carbook_category()`: `authenticated`만 실행, 반환 `uuid`. 5장 표와 같게.
- `car_due_dates (vehicle_id, kind)` unique(`23505`로 충돌이 드러나야 함).

### 8.2 알려진 한계

- 차량 추가 중 추천 항목 insert와 보상 삭제가 둘 다 실패하면 항목 없는 차량이 남는다(RPC가 1개뿐이라는 설계 제약 안에서의 한계). 다음 단계에서 "차량 + 항목 7개"를 한 번에 넣는 RPC가 필요하면 새 계약 변경으로 다룬다.
- `timeout` 뒤 같은 입력을 다시 저장하면 기록이 두 건이 될 수 있다(새 id를 쓰므로). 1인 사용이라 받아들인다.
  - 결정(2026-11-05): 실패한 생성 요청의 id를 `useCarbook`이 들고 있다가 재사용하는 안은 **채택하지 않는다**. 양식을 닫았는지 `useCarbook`이 알 수 없어서, 다른 입력을 새로 저장할 때 이전 id를 재사용하면 이미 저장됐을 수 있는 행을 덮어쓸 위험이 더 크다. 양식 닫힘 신호(`discardPending`)를 넣는 계약 변경이 필요해지면 그때 다룬다.
- `syncEvent`의 upsert는 연결 일정의 `memo`·`color`·`recurrence`도 `null`로 덮는다(BR-25, ADR-003 "행 전체").

## 변경 기록

| 날짜 | 변경 | 이유 | 요청자 | 영향 |
|---|---|---|---|---|
| 2026-11-05 | 최초 작성 | MPR-19 요청 | Software Architect(conv-8c399a) | Backend(MPR-24~28), Frontend(MPR-31~38), Database(MPR-17·18). 호환 깨짐 없음(처음 쓰는 계약) |
| 2026-11-05 | 8장 1~8 승인 반영. 정렬 끝 기준 `id` 명시(Architect 의견 a), 생성 id 재사용 안 채택 사유 기록(의견 b) | Architect 검토 회신 | Software Architect | 동작 변경 없음, 문구만 |
| 2026-11-06 | `updateItem`·`updateDueDate`에 `claimEventId`(event_id 선점) 추가, 수정 질의가 `event_id`를 쓰지 않음, `ItemRowInput`은 생성 전용. 6.2 항목·만기일 행 수정, 8장 9번 | QA F-1(AC-08-13 둘째 문장), Delivery Manager 재요청 | QA Engineer, Delivery Manager | **호환 깨짐**: `updateItem(id, input: ItemRowInput)` → `(id, input: ItemInput, claimEventId?)`, `updateDueDate(id, {dueDate, eventId})` → `(id, dueDate, claimEventId?)`. 아직 구현 전(MPR-24 대기)이라 Backend(MPR-24~28)만 새 시그니처로 구현하면 됨. Architect 결정이 다르면 맞춤 |
