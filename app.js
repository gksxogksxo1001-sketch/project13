/**
 * FocusGuard AI — 과제 BR-B (내 논문을 반영한 애플리케이션) 핵심 엔진 및 UI 스크립트
 *
 * 기반 논문 (과제 10):
 * 『AI 에이전트 기반 웹 개발 환경에서 대기 시간 중 작업자의 분할 주의(Divided Attention)와 인터랙션 행동 분석
 *   ─ 자취생 맞춤형 웹서비스 '혼밥비서' 개발 사례를 중심으로 ─』 (주한태, 2026.10, N=1, 36회 세션)
 *
 * 반영된 논문 핵심 수치 및 규칙 (BRB-C04):
 * 1) 대기 시간 구간별 행동 분포 ([표 2] N=36):
 *    - 0 ~ 15초 (단순 수정, 10회): IDE 지속 주시 80.0%(8회), 화면 검수 20.0%(2회), 모바일 0.0%(0회)
 *    - 16 ~ 30초 (중간 작업, 11회): IDE 지속 주시 27.3%(3회), 화면 검수 54.5%(6회), 모바일 18.2%(2회), 평균 폴링 12.3초
 *    - 31초 이상 (복합 추론, 15회): IDE 지속 주시 6.7%(1회), 화면 검수 66.7%(10회), 모바일 26.7%(4회), 평균 폴링 12.9초
 * 2) 시각적 폴링(Visual Polling) 경계 감시 비용 (4.2절 & 5.2절 제언 1):
 *    - 화면 전환 세션 24회 중 91.7%(22회) 발생, 전체 평균 주기 12.7초 (10~15초 간격)
 * 3) 3지선다 모달 중간(2번째) 옵션 선택 편향 (4.3절 & 5.2절 제언 2):
 *    - 3지선다 세션 23회 중 78.3%(18회) 2번째 옵션 선택 ➔ 옵션당 '1줄 핵심 차이점 + 위험도' 요약 규칙
 * 4) 10분 자체 디버깅 + 에러 컨텍스트 결합 3~5줄 구조화 프롬프트 (3.2절 & 5.2절 제언 3)
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FocusGuardApp = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 1. 논문 실측 상수 및 [표 2] 규칙 테이블
  const PAPER_RULES = {
    paperTitle: "AI 에이전트 기반 웹 개발 환경에서 대기 시간 중 작업자의 분할 주의(Divided Attention)와 인터랙션 행동 분석 ─ 자취생 맞춤형 웹서비스 '혼밥비서' 개발 사례를 중심으로 ─",
    oneSentence: "AI 코딩 에이전트(Antigravity, Copilot 등)와 협업하는 웹 개발자가 16초 이상의 응답 대기 시간 동안 에디터를 힐끔거리며 주의가 분산되거나(12.7초 주기 시각적 폴링 91.7%) 장문의 3지선다 모달에서 2번째 옵션만 편향 선택할 때(78.3%), 이 앱이 논문의 36회 실측 결과와 3대 제언 규칙을 써서 ① 대기 구간별 맞춤형 UI·콘솔 검수 가이드와 무폴링 청각 타이머 작동, ② 3지선다 장문 옵션의 '1줄 핵심 + 위험도' 요약 변환, ③ 에러 로그 결합 3~5줄 구조화 프롬프트 생성 및 36회 원자료 실시간 비교를 해 줍니다.",
    thresholdSec: 16,
    avgPollingIntervalSec: 12.7,
    pollingOccurrenceRate: 0.917, // 22 / 24 (91.7%)
    middleOptionBiasRate: 0.783,  // 18 / 23 (78.3%)
    defaultSelfDebugMin: 10,
    zones: {
      short: {
        id: 'short',
        rangeText: '0 ~ 15초 (단순 수정 구간)',
        sampleCount: 10,
        ideRate: 80.0,
        ideCount: 8,
        inspectRate: 20.0,
        inspectCount: 2,
        mobileRate: 0.0,
        mobileCount: 0,
        avgPollingSec: null,
        dominantAction: 'IDE 지속 주시 80.0%',
        dominantDetail: '표 2: 10회 중 8회 에디터 지속 응시',
        fatigueLevel: '낮음 (몰입 유지 구간)',
        fatigueDetail: '16초 임계치 미만 · 창 전환 불필요',
        prescription: '논문 [표 2] 실측 결과 15초 이하 구간에서는 작업자의 80.0%가 에디터를 지속 주시합니다. 짧은 대기 중 브라우저로 창을 전환하면 오히려 작업 기억 복원 비용(Mark et al., 2008)이 발생하므로 IDE에서 실시간 코드 diff를 바로 확인하세요.',
        checklist: [
          '창 전환(Alt+Tab) 멈추기: 15초 이내 완료되므로 현재 IDE 에디터에 시선 고정하기',
          '실시간 코드 스트리밍 Diff 검수: 수정되는 CSS 클래스명이나 변수 오타 눈으로 확인하기',
          '단일 제안 즉시 검토: 완료 직후 바로 저장 및 반영 상태 확인하기'
        ]
      },
      mid: {
        id: 'mid',
        rangeText: '16 ~ 30초 (중간 작업 구간)',
        sampleCount: 11,
        ideRate: 27.3,
        ideCount: 3,
        inspectRate: 54.5,
        inspectCount: 6,
        mobileRate: 18.2,
        mobileCount: 2,
        avgPollingSec: 12.3,
        dominantAction: '화면 검수 54.5%',
        dominantDetail: '표 2: 11회 중 6회 웹사이트/F12 검수',
        fatigueLevel: '중간 (분할 주의 시작)',
        fatigueDetail: '16초 임계치 초과 · 평균 12.3초 주기 폴링 발생',
        prescription: '논문 4.1절 실측 결과 16초를 넘기면 비동기 화면 검수 행동(54.5%)이 지배적입니다. 단, 12.3초마다 에디터를 힐끔거리는 시각적 폴링 비용을 막기 위해 [무폴링 청각 타이머]를 켜 두고 아래 F12·반응형 검수만 집중해서 수행하세요.',
        checklist: [
          '브라우저 F12 개발자 도구 Console 탭을 열어 빨간색 런타임 에러나 경고가 없는지 점검하기',
          '모바일 뷰포트(375px) 반응형 모드에서 카드 줄바꿈 및 여백 깨짐 유무 확인하기',
          '타이머 종료 알림음이 울릴 때까지 IDE 창을 힐끔거리지 않고 검수에만 집중하기 (시각적 폴링 0회화)'
        ]
      },
      long: {
        id: 'long',
        rangeText: '31초 이상 (복합 추론 구간)',
        sampleCount: 15,
        ideRate: 6.7,
        ideCount: 1,
        inspectRate: 66.7,
        inspectCount: 10,
        mobileRate: 26.7,
        mobileCount: 4,
        avgPollingSec: 12.9,
        dominantAction: '화면 검수 66.7%',
        dominantDetail: '표 2: 15회 중 10회 심층 화면·콘솔 검수',
        fatigueLevel: '높음 (경계 감시 피로 누적)',
        fatigueDetail: '평균 12.9초 주기 폴링 & 모바일 이탈(26.7%) 주의',
        prescription: '논문 [표 2] 실측 결과 31초 이상 구간에서는 IDE 이탈률이 93.3%에 달하며, 평균 12.9초 간격으로 에디터를 힐끔거리는 경계 감시 피로가 극대화됩니다. 스마트폰 알림(26.7%)으로 빠지지 않도록 아래 3단계 실무 검수 루틴을 순서대로 실행하세요.',
        checklist: [
          'F12 Network & Console 탭 점검: 공공 API(식약처 DB 등) 비동기 호출 응답 상태코드(200/CORS) 및 null 예외 확인하기',
          '모바일(375px) & 태블릿 뷰포트 전환 검수: 모달 팝업 스크롤 잠금(100dvh) 및 버튼 가시성(Contrast) 점검하기',
          '에이전트가 3지선다 모달을 띄우면 무조건 2번을 누르지 말고 [할 일 2 요약기]로 위험도를 먼저 비교하기'
        ]
      }
    }
  };

  // 2. 논문 원자료 36회 세션 데이터 내장 (개인정보 0건, 비밀값 0건)
  const INITIAL_SESSIONS_36 = [
    { id: 1, date: '10/14 10:15', task: '[냉장고] 재료 등록 모달 팝업 레이아웃 및 폼 유효성 검사', sec: 12, action: 'IDE 지속 주시', polling: '해당없음', choice: '단일제안 채택', memo: '단순 CSS z-index 및 폼 배치 수정 관찰' },
    { id: 2, date: '10/14 11:30', task: '[냉장고] 식재료 유통기한 D-day 계산 로직 및 신선도 상태 분류', sec: 36, action: '혼밥비서 화면 검수', polling: '12초 후 힐끔 확인', choice: '2번째 옵션 (Day.js 미도입)', memo: '혼밥비서 사이트 열어서 D-3 경고 뱃지 색상 바뀌나 확인' },
    { id: 3, date: '10/14 14:20', task: '[냉장고] 재료 카테고리별(채소/육류/양념) 필터링 탭 이벤트', sec: 14, action: 'IDE 지속 주시', polling: '해당없음', choice: '단일제안 채택', memo: '바닐라 JS 이벤트 위임 코드 생성 대기' },
    { id: 4, date: '10/14 16:00', task: '[식약처 API] 식품영양성분DB Open API 비동기 fetch 호출 파이프라인', sec: 54, action: '혼밥비서 화면 검수', polling: '14초 간격 2회 주시', choice: '2번째 옵션 (프록시 우회)', memo: 'F12 콘솔 열어서 CORS 에러 떴나 확인하다 모달 떠서 클릭' },
    { id: 5, date: '10/14 17:40', task: '[식약처 API] 영양소(칼로리, 탄수화물, 단백질) 데이터 파싱', sec: 26, action: '혼밥비서 화면 검수', polling: '11초 후 힐끔 확인', choice: '2번째 옵션 (기본값 0 처리)', memo: 'API 응답 JSON 키값이 달라 스크린샷 찍어 질문 전달' },
    { id: 6, date: '10/15 09:50', task: '[냉장고] 재료 수정 및 삭제 확인 비동기 커스텀 다이얼로그', sec: 42, action: '모바일 확인', polling: '10초 후 힐끔 확인', choice: '2번째 옵션 (Promise 기반)', memo: '카톡 답장하며 대기하다가 에이전트 끝나서 IDE 복귀' },
    { id: 7, date: '10/15 11:15', task: '[반응형 UI] 모바일 뷰포트(375px) 냉장고 그리드 카드 깨짐 수정', sec: 24, action: '혼밥비서 화면 검수', polling: '13초 후 힐끔 확인', choice: '2번째 옵션 (CSS Grid minmax)', memo: 'F12 개발자도구 모바일 모드로 카드 줄바꿈 실시간 검수' },
    { id: 8, date: '10/15 14:05', task: '[냉장고 점수] 보유 재료 영양 밸런스 점수 산출 알고리즘', sec: 46, action: '혼밥비서 화면 검수', polling: '15초 간격 2회 주시', choice: '2번째 옵션 (가중치 방식)', memo: '10분간 수식 고민하다 답답해서 에이전트 호출, 화면 검수' },
    { id: 9, date: '10/15 15:30', task: '[UI/UX] 유통기한 임박 식재료 상단 경고 토스트 팝업', sec: 13, action: 'IDE 지속 주시', polling: '해당없음', choice: '단일제안 채택', memo: '음악 들으며 코드 스트리밍 관찰' },
    { id: 10, date: '10/15 17:10', task: '[커뮤니티] 자취생 수다방 게시글 목록 무한 스크롤 연동', sec: 28, action: '혼밥비서 화면 검수', polling: '12초 후 힐끔 확인', choice: '2번째 옵션 (IntersectionObs)', memo: 'F12 콘솔 보며 스크롤 이벤트 디바운스 상태 체크' },
    { id: 11, date: '10/16 10:20', task: '[식약처 API] 검색어 자동완성 연관 식품 추천 드롭다운', sec: 22, action: '혼밥비서 화면 검수', polling: '14초 후 힐끔 확인', choice: '2번째 옵션 (로컬 캐싱)', memo: '검색창에 계란 치고 드롭다운 UI 가시성 점검' },
    { id: 12, date: '10/16 11:45', task: '[냉장고] 재료 유통기한 D-day 정렬 (오름차순/내림차순) 기능', sec: 11, action: 'IDE 지속 주시', polling: '해당없음', choice: '단일제안 채택', memo: '화면 지켜보며 빠른 완료 확인' },
    { id: 13, date: '10/16 14:10', task: '[에러 디버깅] 식약처 API 영양성분 null 값 반환 시 계산 오류', sec: 50, action: '혼밥비서 화면 검수', polling: '13초 간격 2회 주시', choice: '2번째 옵션 (옵셔널 체이닝)', memo: '10분간 에러 헤매다 스크린샷 캡처로 질문. 2번 옵션 채택' },
    { id: 14, date: '10/16 16:30', task: '[반응형 UI] 모바일 환경 모달 팝업 내부 스크롤 잠금 처리', sec: 29, action: '혼밥비서 화면 검수', polling: '11초 후 힐끔 확인', choice: '2번째 옵션 (body overflow)', memo: 'F12 모바일 모드 켜고 뒤쪽 화면 스크롤되나 손으로 스크롤' },
    { id: 15, date: '10/17 09:30', task: '[캐릭터] 냉장고 신선도 점수에 따른 캐릭터 표정 스프라이트', sec: 10, action: 'IDE 지속 주시', polling: '해당없음', choice: '단일제안 채택', memo: 'SVG 표정 이미지 변경 로직 대기' },
    { id: 16, date: '10/17 11:00', task: '[냉장고] 식재료 대량 일괄 선택 및 삭제 모드 토글', sec: 45, action: '모바일 확인', polling: '10초 후 힐끔 확인', choice: '3번째 옵션 (너무 길었으나 선택)', memo: '핸드폰 메시지 보며 대기, 옵션 3번 클릭' },
    { id: 17, date: '10/17 14:30', task: '[커뮤니티] 댓글 작성 시 즉시 DOM 추가 및 비동기 저장', sec: 15, action: 'IDE 지속 주시', polling: '해당없음', choice: '단일제안 채택', memo: '화면 주시' },
    { id: 18, date: '10/17 16:15', task: '[식약처 API] 일일 트래픽 초과 시 로컬 더미 데이터 폴백 처리', sec: 34, action: '혼밥비서 화면 검수', polling: '15초 후 힐끔 확인', choice: '2번째 옵션 (Try-Catch 분기)', memo: 'F12 콘솔에서 catch 블록 진입하나 새로고침 테스트' },
    { id: 19, date: '10/18 10:40', task: '[반응형 UI] 태블릿 및 모바일 가로 모드 시 레이아웃 정렬', sec: 25, action: '혼밥비서 화면 검수', polling: '12초 후 힐끔 확인', choice: '2번째 옵션 (CSS flex-wrap)', memo: '크롬 창 너비 줄였다 늘렸다 하며 깨짐 검수' },
    { id: 20, date: '10/18 13:50', task: '[냉장고] 유통기한 지난 식재료 붉은색 깜빡임 CSS 애니메이션', sec: 12, action: 'IDE 지속 주시', polling: '해당없음', choice: '단일제안 채택', memo: 'CSS 키프레임 적용 관찰' },
    { id: 21, date: '10/18 15:20', task: '[에러 디버깅] 재료 추가 모달 닫을 때 이전 입력값 초기화 안 됨', sec: 48, action: '혼밥비서 화면 검수', polling: '14초 간격 2회 주시', choice: '1번째 옵션 (form.reset)', memo: '에이전트가 또 실패해서 멘탈 흔들렸으나 2회차에 1번 선택해 해결' },
    { id: 22, date: '10/18 17:00', task: '[냉장고] 소비기한 권장 섭취 기간 툴팁 마우스오버 연동', sec: 18, action: 'IDE 지속 주시', polling: '해당없음', choice: '단일제안 채택', memo: '마우스 호버 위치 확인 대기' },
    { id: 23, date: '10/19 11:20', task: '[커뮤니티] 혼밥 꿀팁 게시글 좋아요 토글 및 숫자 실시간 반영', sec: 14, action: 'IDE 지속 주시', polling: '해당없음', choice: '단일제안 채택', memo: '빠른 수정 주시' },
    { id: 24, date: '10/19 14:00', task: '[냉장고] 식재료 보관 장소(냉장실/냉동실/실온) 탭 분류', sec: 20, action: 'IDE 지속 주시', polling: '해당없음', choice: '단일제안 채택', memo: '코드 diff 빠르게 확인' },
    { id: 25, date: '10/19 15:40', task: '[식약처 API] 영양소 섭취 비율 막대그래프 시각화 연동', sec: 58, action: '혼밥비서 화면 검수', polling: '14초 간격 3회 주시', choice: '2번째 옵션 (순수 CSS bar)', memo: '3번 옵션은 라이브러리 추가라 너무 길어 패스, 2번 CSS 선택' },
    { id: 26, date: '10/19 17:15', task: '[반응형 UI] 모바일 하단 네비게이션 탭바 고정 및 아이콘 정렬', sec: 27, action: '모바일 확인', polling: '11초 후 힐끔 확인', choice: '2번째 옵션 (fixed 하단 바)', memo: '연락 확인하며 대기' },
    { id: 27, date: '10/20 10:10', task: '[냉장고] 등록된 재료 검색어 실시간 필터링(한글 초성 검색)', sec: 43, action: '모바일 확인', polling: '13초 후 힐끔 확인', choice: '2번째 옵션 (유니코드 분해)', memo: '연락 확인하다가 화면 힐끔거림' },
    { id: 28, date: '10/20 11:35', task: '[CSS] 다크모드 대응 식재료 신선도 뱃지 대비비(Contrast) 개선', sec: 15, action: '혼밥비서 화면 검수', polling: '해당없음', choice: '단일제안 채택', memo: '가시성 지적 반영 확인' },
    { id: 29, date: '10/20 14:15', task: '[에러 디버깅] 모바일 사파리에서 모달 팝업 100vh 스크롤 버그', sec: 52, action: '혼밥비서 화면 검수', polling: '15초 간격 2회 주시', choice: '2번째 옵션 (dvh 적용)', memo: '스크린샷 첨부하며 가시성 확보 지시 전달 후 F12 콘솔 확인' },
    { id: 30, date: '10/20 16:30', task: '[냉장고] 보유 재료 기반 오늘 먹을 수 있는 요리 매칭', sec: 37, action: '혼밥비서 화면 검수', polling: '12초 후 힐끔 확인', choice: '2번째 옵션 (배열 교집합)', memo: '레시피 탭 넘어가서 카드 클릭해봄' },
    { id: 31, date: '10/21 09:40', task: '[커뮤니티] 게시글 이미지 업로드 전 클라이언트 리사이징', sec: 35, action: 'IDE 지속 주시', polling: '해당없음', choice: '1번째 옵션 (단순 압축)', memo: '화면 주시하며 1번 옵션 선택' },
    { id: 32, date: '10/21 11:00', task: '[식약처 API] 영양소 섭취 권장량 대비 과다/부족 경고 문구', sec: 26, action: '모바일 확인', polling: '13초 후 힐끔 확인', choice: '3번째 옵션 (상세 가이드)', memo: '3번 옵션 선택' },
    { id: 33, date: '10/21 13:40', task: '[반응형 UI] 식재료 카드 호버 시 액션 버튼 슬라이드 애니메이션', sec: 14, action: '혼밥비서 화면 검수', polling: '해당없음', choice: '단일제안 채택', memo: '화면 전환해서 호버 테스트' },
    { id: 34, date: '10/21 15:10', task: '[에러 디버깅] 재료 삭제 시 냉장고 점수 실시간 재계산 누락 버그', sec: 49, action: '혼밥비서 화면 검수', polling: '12초 간격 2회 주시', choice: '1번째 옵션 (이벤트 디스패치)', memo: 'F12 콘솔 에러 확인 후 1번 선택해 즉시 해결' },
    { id: 35, date: '10/21 16:20', task: '[냉장고] 유통기한 D-day 캘린더 뷰와 리스트 뷰 전환 토글', sec: 19, action: 'IDE 지속 주시', polling: '해당없음', choice: '단일제안 채택', memo: 'CSS 탭 전환 관찰' },
    { id: 36, date: '10/21 17:30', task: '[전체 검수] 혼밥비서 최종 빌드 번들 및 전역 콘솔 에러 클리어', sec: 55, action: '모바일 확인', polling: '14초 간격 3회 주시', choice: '2번째 옵션 (린트 클린업)', memo: 'F12 콘솔에 경고 1개도 안 남았나 점검 후 복귀' }
  ];

  // 3. 논문 속 3지선다 모달 실제 시나리오 프리셋 3종
  const MODAL_SCENARIOS = {
    api: {
      title: '사례 A: 식약처 영양성분 API null 값 반환 에러 처리 (논문 세션 #13, 대기 50초)',
      opt1: '옵션 1 (단순 조건문 무시): API 응답에서 영양소 필드가 없을 때 에러가 나지 않도록 해당 식재료 렌더링 자체를 return null로 건너뛰고 화면에 표시하지 않습니다.',
      opt2: '옵션 2 (옵셔널 체이닝 + 기본값 0 폴백): 기존 렌더러 구조를 유지하면서 item?.NUTR_CONT1 ?? 0 형태로 ES2020 옵셔널 체이닝과 Nullish 병합 연산자를 적용해 결측치만 0kcal로 안전하게 표시합니다.',
      opt3: '옵션 3 (전역 스키마 검증 라이브러리 도입 및 클래스 리팩토링): 외부 데이터 검증 라이브러리인 Zod와 Axios 인터셉터 계층을 새로 설치하고, 모든 공공 API 응답 DTO 클래스를 전면 재설계하여 런타임 타입 검증 파이프라인과 에러 바운더리 컴포넌트를 아키텍처 전반에 구축합니다. 이 방식은 파일 12개를 수정해야 합니다.'
    },
    dday: {
      title: '사례 B: 식재료 유통기한 D-day 계산 및 신선도 뱃지 분류 (논문 세션 #2, 대기 36초)',
      opt1: '옵션 1 (단순 일수 뺄셈 하드코딩): 현재 날짜의 getDate()에서 입력 날짜의 getDate()만 단순 차감하여 D-day를 구합니다. (월이 바뀌거나 윤년일 때는 오차가 발생할 수 있음)',
      opt2: '옵션 2 (표준 Date 자정 정규화 계산): 외부 라이브러리 추가 없이 new Date(y, m, d)로 자정(00:00:00) 기준 타임스탬프 차이를 86,400,000ms로 나누어 정확한 D-day를 산출하고 D-3 이하 경고 뱃지를 부여합니다.',
      opt3: '옵션 3 (Moment.js 및 타임존 국제화 플러그인 전체 설치): Moment.js와 moment-timezone 패키지를 번들에 추가하고 다국어 로케일 포매터와 비동기 워커 스케줄러를 구성하여 밀리초 단위의 글로벌 타임존 동기화 엔진을 구현합니다.'
    },
    chart: {
      title: '사례 C: 영양소 섭취 비율 막대그래프 시각화 연동 (논문 세션 #25, 대기 58초)',
      opt1: '옵션 1 (텍스트 퍼센트만 출력): 막대그래프 UI를 포기하고 단순 텍스트로 탄수화물 50%, 단백질 30%, 지방 20% 숫자만 나열합니다.',
      opt2: '옵션 2 (순수 CSS Flexbox 비율 바): 외부 차트 라이브러리 없이 순수 CSS width 퍼센트와 transition 애니메이션으로 가볍고 모바일(375px)에서도 깨지지 않는 스택형 영양소 막대그래프를 구현합니다.',
      opt3: '옵션 3 (D3.js 및 Canvas WebGL 차트 엔진 통합): D3.js 전체 모듈과 Canvas 리사이즈 옵저버, 커스텀 툴팁 가상 DOM 렌더러를 설치하여 3차원 그라데이션 막대 차트와 물리 애니메이션 루프를 구축합니다.'
    }
  };

  // HTML 태그 이스케이프/제거 유틸 (XSS 및 잘못된 입력 방어)
  function sanitizeText(raw, fallbackText) {
    if (raw === null || raw === undefined) return fallbackText;
    const cleaned = String(raw)
      .replace(/<[^>]*>?/gm, '')
      .trim();
    return cleaned.length > 0 ? cleaned.slice(0, 1000) : fallbackText;
  }

  // =========================================================================
  // [할 일 1 핵심 함수] 대기 시간 입력 방어 및 논문 [표 2] 기반 행동 진단
  // =========================================================================
  function diagnoseLatency(rawSecInput, rawTaskInput) {
    const safeTask = sanitizeText(rawTaskInput, '[혼밥비서] 프론트엔드 UI 및 콘솔 검수 작업');
    let guardTriggered = false;
    let guardReason = '';
    let sec = 25;

    const rawStr = rawSecInput === null || rawSecInput === undefined ? '' : String(rawSecInput).trim();

    if (rawStr === '') {
      guardTriggered = true;
      sec = 25;
      guardReason = '대기 시간 입력값이 비어 있어("") 앱을 멈추지 않고 논문 중간 작업 기본값(25초)으로 자동 보정했습니다.';
    } else {
      const parsed = Number(rawStr);
      if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
        guardTriggered = true;
        sec = 25;
        guardReason = `입력값 "${sanitizeText(rawStr, '잘못된 문자')}"은(는) 숫자가 아니어서 안전 기본값(25초, 중간 작업 구간)으로 자동 보정했습니다.`;
      } else if (parsed <= 0) {
        guardTriggered = true;
        sec = 10;
        guardReason = `0 이하의 입력값(${parsed}초)이 감지되어 최소 단순 수정 구간 기본값(10초)으로 안전하게 보정했습니다.`;
      } else if (parsed > 600) {
        guardTriggered = true;
        sec = 60;
        guardReason = `초대형 입력값(${parsed}초)이 감지되어 최대 안전 상한(60초, 복합 추론 구간)으로 자동 보정했습니다.`;
      } else {
        sec = Math.round(parsed);
        if (sec !== parsed) {
          guardTriggered = true;
          guardReason = `소수점 입력값(${parsed}초)을 정수(${sec}초)로 반올림하여 정확히 진단했습니다.`;
        }
      }
    }

    // 논문 [표 2] 구간 분류 규칙
    let zoneKey = 'mid';
    if (sec <= 15) {
      zoneKey = 'short';
    } else if (sec <= 30) {
      zoneKey = 'mid';
    } else {
      zoneKey = 'long';
    }

    const zone = PAPER_RULES.zones[zoneKey];

    // 논문 4.2절 시각적 폴링(Visual Polling) 횟수 계산
    // 16초 이상일 때 평균 12.7초 주기(구간별 12.3초 / 12.9초), 발생률 91.7% 반영
    let expectedPolls = 0;
    if (sec >= PAPER_RULES.thresholdSec) {
      const interval = zone.avgPollingSec || PAPER_RULES.avgPollingIntervalSec;
      expectedPolls = Math.max(1, Math.round((sec / interval) * PAPER_RULES.pollingOccurrenceRate));
    }

    return {
      inputRaw: rawSecInput,
      sanitizedSec: sec,
      sanitizedTask: safeTask,
      guardTriggered,
      guardReason,
      zoneKey,
      zone,
      expectedPolls,
      pollingSavedText: expectedPolls > 0
        ? `${expectedPolls}회 힐끔거림 ➔ 0회 (완전 방어)`
        : '0회 (15초 이하 단기 집중 구간)'
    };
  }

  // =========================================================================
  // [할 일 2 핵심 함수] 3지선다 모달 '1줄 핵심 + 위험도' 요약 및 78.3% 편향 분석
  // =========================================================================
  function analyzeSingleOption(rawText, index) {
    const defaultFallbacks = [
      '옵션 1: 단순 조건 처리 또는 최소 변경 방식',
      '옵션 2: 표준 브라우저 API 및 기존 구조 유지 타협안',
      '옵션 3: 외부 라이브러리 추가 및 대규모 구조 리팩토링 방식'
    ];

    const trimmed = rawText === null || rawText === undefined ? '' : String(rawText).trim();
    const isEmpty = trimmed.length === 0;
    const text = isEmpty ? defaultFallbacks[index - 1] : sanitizeText(trimmed, defaultFallbacks[index - 1]);
    const charLen = text.length;

    // 핵심 1줄 추출: 첫 문장 또는 68자 요약
    let oneLiner = text.split(/(?<=[.!?다요음함])\s+/)[0] || text;
    if (oneLiner.length > 72) {
      oneLiner = oneLiner.slice(0, 70) + '…';
    }

    // 위험도 및 인지 부하 판정 (논문 4.3절 & 5.2절 제언 2 규칙)
    const highRiskKeywords = /라이브러리|설치|전면|재설계|리팩토링|인터셉터|아키텍처|파일\s*\d+개|D3\.js|Moment\.js|Zod|하드코딩|포기하고|건너뛰고/i;
    const lowRiskKeywords = /옵셔널 체이닝|표준|순수 CSS|유지하면서|자정|Flexbox|Grid|기본값/i;

    let riskLevel = '보통';
    let riskBadgeClass = 'badge-warning';
    let score = 75;

    if (highRiskKeywords.test(text) || charLen >= 135) {
      riskLevel = '높음 (과도한 복잡도/누락 위험)';
      riskBadgeClass = 'badge-danger';
      score = index === 1 ? 58 : 62;
    } else if (lowRiskKeywords.test(text)) {
      riskLevel = '낮음 (표준·안정적 변경)';
      riskBadgeClass = 'badge-success';
      score = 92;
    } else if (index === 1 && charLen < 65) {
      riskLevel = '보통 (예외 케이스 누락 주의)';
      riskBadgeClass = 'badge-warning';
      score = 70;
    }

    const cognitiveLoad = charLen >= 120 ? '높음 (장문 피로 · 스킵 주의)' : (charLen <= 55 ? '낮음 (단순 요약)' : '적정 (직관적 분량)');

    return {
      index,
      isEmpty,
      originalLength: isEmpty ? 0 : charLen,
      oneLiner,
      riskLevel,
      riskBadgeClass,
      cognitiveLoad,
      score
    };
  }

  function summarizeThreeOptions(rawOpt1, rawOpt2, rawOpt3) {
    const items = [
      analyzeSingleOption(rawOpt1, 1),
      analyzeSingleOption(rawOpt2, 2),
      analyzeSingleOption(rawOpt3, 3)
    ];

    const anyEmpty = items.some(it => it.isEmpty);
    let guardTriggered = false;
    let guardReason = '';

    if (anyEmpty) {
      guardTriggered = true;
      guardReason = '비어 있는 선택지 입력란이 감지되어 앱이 멈추지 않도록 기본 비교 템플릿으로 자동 보완해 분석했습니다.';
    }

    // 최고 점수 옵션 찾기
    let bestItem = items[0];
    items.forEach(item => {
      if (item.score > bestItem.score) bestItem = item;
    });

    const biasWarningText =
      `논문 4.3절 실측 결과, 작업자는 3지선다 모달 23회 중 18회(78.3%)에서 긴 설명(주로 3번, 현재 ${items[2].originalLength}자)을 읽지 않고 무의식적으로 2번째 옵션을 선택했습니다. ` +
      `아래 ‘1줄 핵심 요약’과 ‘위험도’를 먼저 비교한 뒤 선택하세요. (현재 객관적 추천: 옵션 ${bestItem.index})`;

    return {
      guardTriggered,
      guardReason,
      items,
      recommendedIndex: bestItem.index,
      biasRatePercent: 78.3,
      biasWarningText
    };
  }

  // =========================================================================
  // [할 일 3 핵심 함수] 10분 자체 디버깅 + 에러 컨텍스트 결합 4줄 프롬프트 생성기
  // =========================================================================
  function buildStructuredPrompt(rawModule, rawDebugMin, rawErrorLog, rawUxGoal) {
    let guardTriggered = false;
    const reasons = [];

    const mod = sanitizeText(rawModule, '[혼밥비서] 프론트엔드 모듈');
    if (!rawModule || String(rawModule).trim() === '') {
      guardTriggered = true;
      reasons.push('모듈명 빈칸 기본값 보완');
    }

    let debugMin = Number(rawDebugMin);
    if (!Number.isFinite(debugMin) || debugMin <= 0 || debugMin > 180) {
      guardTriggered = true;
      debugMin = PAPER_RULES.defaultSelfDebugMin;
      reasons.push('디버깅 시간(분)을 논문 기준값(10분)으로 자동 보정');
    } else {
      debugMin = Math.round(debugMin);
    }

    const errLog = sanitizeText(rawErrorLog, 'F12 콘솔 에러 및 모바일 뷰포트(375px) 레이아웃 깨짐 현상');
    if (!rawErrorLog || String(rawErrorLog).trim() === '') {
      guardTriggered = true;
      reasons.push('에러 로그 빈칸 기본값 보완');
    }

    const uxGoal = sanitizeText(rawUxGoal, '외부 무거운 라이브러리 추가 없이 안전하게 예외를 처리하고 모바일(375px) 가시성을 확보해 줘.');

    const lines = [
      `1. [작업 모듈 & 사전 점검]: ${mod} 구현 중 ${debugMin}분간 F12 개발자 도구로 자체 디버깅을 수행했습니다.`,
      `2. [관측된 에러/증상]: "${errLog}" 문제가 발생하고 있습니다.`,
      `3. [원하는 UI/UX 및 제약]: ${uxGoal}`,
      `4. [응답 형식 요청]: 논문 5.2절 제언에 따라 3지선다 제시 시 장문 설명을 피하고 '옵션당 핵심 차이점 1줄 + 위험도'로 요약해 제시해 주세요.`
    ];

    return {
      guardTriggered,
      guardReason: reasons.length > 0 ? `입력 방어 작동: ${reasons.join(', ')}` : '',
      debugMin,
      promptText: lines.join('\n'),
      lineCount: lines.length
    };
  }

  // =========================================================================
  // [통계 집계 함수] 논문 원자료(36건) + 사용자 추가 세션 실시간 통계 계산
  // =========================================================================
  function computeDatasetStats(sessions) {
    const list = Array.isArray(sessions) && sessions.length > 0 ? sessions : INITIAL_SESSIONS_36;
    const total = list.length;

    const over16 = list.filter(s => s.sec >= 16);
    const over16Inspect = over16.filter(s => s.action.includes('검수'));
    const inspectRateOver16 = over16.length > 0
      ? ((over16Inspect.length / over16.length) * 100).toFixed(1)
      : '0.0';

    const modalSessions = list.filter(s => !String(s.choice).includes('단일제안'));
    const middleChoices = modalSessions.filter(s => String(s.choice).includes('2번째'));
    const middleBiasRate = modalSessions.length > 0
      ? ((middleChoices.length / modalSessions.length) * 100).toFixed(1)
      : '0.0';

    return {
      totalCount: total,
      addedCount: Math.max(0, total - INITIAL_SESSIONS_36.length),
      over16Count: over16.length,
      over16InspectCount: over16Inspect.length,
      inspectRateOver16: `${inspectRateOver16}%`,
      modalSessionCount: modalSessions.length,
      middleChoiceCount: middleChoices.length,
      middleBiasRate: `${middleBiasRate}%`
    };
  }

  // =========================================================================
  // 브라우저 DOM 인터랙션 초기화
  // =========================================================================
  function initBrowserApp() {
    if (typeof document === 'undefined') return;

    const sessions = INITIAL_SESSIONS_36.slice();
    let timerInterval = null;
    let remainingSec = 25;
    let totalTimerSec = 25;

    // 테마 전환
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        const current = html.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        themeToggle.textContent = next === 'dark' ? '☀️ 라이트 모드' : '🌙 다크 모드';
      });
    }

    // Web Audio API 비프음 재생기 (외부 오디오 파일 없이 100% 브라우저 내장 동작)
    function playNotificationBeep(type) {
      const soundSelect = document.getElementById('input-sound-toggle');
      if (soundSelect && soundSelect.value === 'off') return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'done') {
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.12);
          gain.gain.setValueAtTime(0.18, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
          osc.start();
          osc.stop(ctx.currentTime + 0.45);
        } else {
          osc.frequency.setValueAtTime(660, ctx.currentTime);
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
          osc.start();
          osc.stop(ctx.currentTime + 0.18);
        }
      } catch (_) {
        // 오디오 컨텍스트 제한 시에도 절대 멈추지 않음
      }
    }

    // 전역 입력 방어 알림 표시
    function showGlobalGuard(title, desc) {
      const box = document.getElementById('global-guard-alert');
      const titleEl = document.getElementById('guard-alert-title');
      const descEl = document.getElementById('guard-alert-desc');
      if (!box || !titleEl || !descEl) return;
      titleEl.textContent = title;
      descEl.textContent = desc;
      box.classList.remove('hidden');
    }

    function hideGlobalGuard() {
      const box = document.getElementById('global-guard-alert');
      if (box) box.classList.add('hidden');
    }

    // 시간 포맷 (MM:SS)
    function formatMMSS(sec) {
      const s = Math.max(0, Math.round(sec));
      const m = Math.floor(s / 60);
      const rem = s % 60;
      return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    }

    // [할 일 1] 화면 렌더링
    function renderLatencyDiagnosis(showGuardBanner) {
      const taskInput = document.getElementById('input-task-name');
      const secInput = document.getElementById('input-latency-sec');
      const guardMsg = document.getElementById('latency-guard-msg');

      const diag = diagnoseLatency(
        secInput ? secInput.value : 25,
        taskInput ? taskInput.value : ''
      );

      if (diag.guardTriggered) {
        if (guardMsg) {
          guardMsg.textContent = `🛡️ [입력 방어 작동] ${diag.guardReason}`;
          guardMsg.classList.remove('hidden');
        }
        if (showGuardBanner) {
          showGlobalGuard('할 일 1 — 잘못된 대기 시간 입력 자동 방어 완료', diag.guardReason);
        }
      } else {
        if (guardMsg) guardMsg.classList.add('hidden');
      }

      // 타이머 기본 시간 세팅
      totalTimerSec = diag.sanitizedSec;
      remainingSec = diag.sanitizedSec;
      const digitsEl = document.getElementById('timer-digits');
      const fillEl = document.getElementById('timer-progress-fill');
      const savedEl = document.getElementById('timer-polling-saved');
      if (digitsEl) digitsEl.textContent = formatMMSS(remainingSec);
      if (fillEl) fillEl.style.width = '0%';
      if (savedEl) {
        savedEl.innerHTML = `예상 시각적 폴링 방어: <strong>${diag.expectedPolls}회</strong> (12.7초 주기 기준)`;
      }

      // 우측 패널 업데이트
      const zoneBadge = document.getElementById('result-zone-badge');
      if (zoneBadge) {
        zoneBadge.textContent = diag.zone.rangeText;
        zoneBadge.className = `zone-badge zone-${diag.zoneKey}`;
      }

      const domProb = document.getElementById('stat-dominant-prob');
      const domDetail = document.getElementById('stat-dominant-detail');
      const pollCount = document.getElementById('stat-polling-count');
      const pollDetail = document.getElementById('stat-polling-detail');
      const fatLevel = document.getElementById('stat-fatigue-level');
      const fatDetail = document.getElementById('stat-fatigue-detail');

      if (domProb) domProb.textContent = diag.zone.dominantAction;
      if (domDetail) domDetail.textContent = diag.zone.dominantDetail;
      if (pollCount) pollCount.textContent = diag.pollingSavedText;
      if (pollDetail) {
        pollDetail.textContent = diag.zone.avgPollingSec
          ? `논문 실측 평균 ${diag.zone.avgPollingSec}초 주기 경계 감시 제거`
          : '15초 이내 완료 구간 (창 전환 불필요)';
      }
      if (fatLevel) fatLevel.textContent = diag.zone.fatigueLevel;
      if (fatDetail) fatDetail.textContent = diag.zone.fatigueDetail;

      // 분포 바 업데이트
      const sampleN = document.getElementById('prob-sample-n');
      if (sampleN) sampleN.textContent = `구간 표본: N=${diag.zone.sampleCount} 세션`;

      const barIdeLbl = document.getElementById('bar-label-ide');
      const barIdeFill = document.getElementById('bar-fill-ide');
      const barInsLbl = document.getElementById('bar-label-inspect');
      const barInsFill = document.getElementById('bar-fill-inspect');
      const barMobLbl = document.getElementById('bar-label-mobile');
      const barMobFill = document.getElementById('bar-fill-mobile');

      if (barIdeLbl) barIdeLbl.textContent = `${diag.zone.ideRate.toFixed(1)}% (${diag.zone.ideCount}회)`;
      if (barIdeFill) barIdeFill.style.width = `${diag.zone.ideRate}%`;
      if (barInsLbl) barInsLbl.textContent = `${diag.zone.inspectRate.toFixed(1)}% (${diag.zone.inspectCount}회)`;
      if (barInsFill) barInsFill.style.width = `${diag.zone.inspectRate}%`;
      if (barMobLbl) barMobLbl.textContent = `${diag.zone.mobileRate.toFixed(1)}% (${diag.zone.mobileCount}회)`;
      if (barMobFill) barMobFill.style.width = `${diag.zone.mobileRate}%`;

      // 체크리스트 렌더링
      const prescMsg = document.getElementById('prescription-message');
      if (prescMsg) prescMsg.textContent = diag.zone.prescription;

      const checklistUl = document.getElementById('dynamic-checklist');
      const progressText = document.getElementById('checklist-progress-text');

      function updateChecklistProgress() {
        if (!checklistUl || !progressText) return;
        const totalItems = checklistUl.querySelectorAll('li').length;
        const doneItems = checklistUl.querySelectorAll('li.done').length;
        const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
        progressText.textContent = `${doneItems} / ${totalItems} 완료 (${pct}%)`;
      }

      if (checklistUl) {
        checklistUl.innerHTML = '';
        diag.zone.checklist.forEach((itemText, idx) => {
          const li = document.createElement('li');
          li.innerHTML = `<input type="checkbox" id="chk-item-${idx}" aria-label="${itemText}"> <span>${itemText}</span>`;
          const chk = li.querySelector('input');
          li.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
              chk.checked = !chk.checked;
            }
            li.classList.toggle('done', chk.checked);
            updateChecklistProgress();
          });
          checklistUl.appendChild(li);
        });
        updateChecklistProgress();
      }

      return diag;
    }

    // 타이머 제어
    const btnStartTimer = document.getElementById('btn-start-timer');
    const btnStopTimer = document.getElementById('btn-stop-timer');
    const latencyForm = document.getElementById('latency-form');

    function stopTimer(resetText) {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      if (btnStartTimer) btnStartTimer.disabled = false;
      if (btnStopTimer) btnStopTimer.disabled = true;
      const statusBadge = document.getElementById('timer-status-badge');
      if (statusBadge && resetText) statusBadge.textContent = resetText;
    }

    if (latencyForm) {
      latencyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        stopTimer('대기 진단 완료 · 타이머 준비');
        renderLatencyDiagnosis(true);
      });
    }

    if (btnStartTimer) {
      btnStartTimer.addEventListener('click', () => {
        stopTimer();
        const diag = renderLatencyDiagnosis(true);
        totalTimerSec = diag.sanitizedSec;
        remainingSec = diag.sanitizedSec;

        const statusBadge = document.getElementById('timer-status-badge');
        const guideText = document.getElementById('timer-guide-text');
        const digitsEl = document.getElementById('timer-digits');
        const fillEl = document.getElementById('timer-progress-fill');

        if (btnStartTimer) btnStartTimer.disabled = true;
        if (btnStopTimer) btnStopTimer.disabled = false;
        if (statusBadge) statusBadge.textContent = '🟢 무폴링 타이머 작동 중 (시선 고정 방어)';
        if (guideText) {
          guideText.innerHTML = `진행 중: <strong>[${diag.sanitizedTask}]</strong> — 완료 알림음이 울릴 때까지 에디터를 힐끔거리지 말고 우측 체크리스트를 수행하세요.`;
        }

        playNotificationBeep('start');

        timerInterval = setInterval(() => {
          remainingSec -= 1;
          const elapsed = totalTimerSec - remainingSec;
          const pct = Math.min(100, Math.round((elapsed / totalTimerSec) * 100));

          if (digitsEl) digitsEl.textContent = formatMMSS(remainingSec);
          if (fillEl) fillEl.style.width = `${pct}%`;

          if (remainingSec <= 0) {
            stopTimer('✅ 에이전트 작업 완료! 이제 IDE로 복귀하세요');
            if (guideText) {
              guideText.innerHTML = `🎉 <strong>${totalTimerSec}초 무폴링 대기 완료!</strong> 12.7초 주기의 불필요한 시각적 폴링(${diag.expectedPolls}회) 없이 집중 흐름을 완벽히 지켰습니다.`;
            }
            playNotificationBeep('done');
          }
        }, 1000);
      });
    }

    if (btnStopTimer) {
      btnStopTimer.addEventListener('click', () => {
        stopTimer('⏹️ 타이머 정지됨 · 초기 상태 복구');
        renderLatencyDiagnosis(false);
      });
    }

    // 할 일 1 프리셋 버튼
    document.querySelectorAll('.latency-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const sec = btn.getAttribute('data-sec');
        const task = btn.getAttribute('data-task');
        const secInput = document.getElementById('input-latency-sec');
        const taskInput = document.getElementById('input-task-name');
        if (secInput) secInput.value = sec;
        if (taskInput) taskInput.value = task;
        hideGlobalGuard();
        stopTimer('프리셋 적용 완료 · 타이머 준비');
        renderLatencyDiagnosis(false);
      });
    });

    // =========================================================================
    // [할 일 2] 3지선다 모달 요약기 렌더링 및 이벤트
    // =========================================================================
    function loadModalScenario(key) {
      const sc = MODAL_SCENARIOS[key] || MODAL_SCENARIOS.api;
      const o1 = document.getElementById('opt-input-1');
      const o2 = document.getElementById('opt-input-2');
      const o3 = document.getElementById('opt-input-3');
      if (o1) o1.value = sc.opt1;
      if (o2) o2.value = sc.opt2;
      if (o3) o3.value = sc.opt3;
      renderModalSummary(false);
    }

    function renderModalSummary(showGuardBanner) {
      const o1 = document.getElementById('opt-input-1');
      const o2 = document.getElementById('opt-input-2');
      const o3 = document.getElementById('opt-input-3');
      const guardMsg = document.getElementById('modal-guard-msg');
      const bannerEl = document.getElementById('bias-analysis-banner');
      const listEl = document.getElementById('summarized-options-list');
      const feedbackEl = document.getElementById('decision-feedback-box');

      const result = summarizeThreeOptions(
        o1 ? o1.value : '',
        o2 ? o2.value : '',
        o3 ? o3.value : ''
      );

      if (result.guardTriggered) {
        if (guardMsg) {
          guardMsg.textContent = `🛡️ [입력 방어 작동] ${result.guardReason}`;
          guardMsg.classList.remove('hidden');
        }
        if (showGuardBanner) {
          showGlobalGuard('할 일 2 — 빈 3지선다 옵션 입력 자동 방어 완료', result.guardReason);
        }
      } else {
        if (guardMsg) guardMsg.classList.add('hidden');
      }

      if (bannerEl) {
        bannerEl.innerHTML = `<strong>⚠️ 논문 4.3절 편향 경고:</strong> ${result.biasWarningText}`;
      }

      if (listEl) {
        listEl.innerHTML = '';
        result.items.forEach(item => {
          const isRec = item.index === result.recommendedIndex;
          const card = document.createElement('div');
          card.className = `summary-opt-card${isRec ? ' recommended' : ''}`;
          card.innerHTML = `
            <div class="opt-card-top">
              <span class="opt-title-tag">옵션 ${item.index} 핵심 1줄 요약 ${isRec ? '🌟 (객관적 추천)' : ''}</span>
              <div class="opt-badges">
                <span class="badge ${item.riskBadgeClass}">위험도: ${item.riskLevel}</span>
                <span class="badge badge-primary">적합도 ${item.score}점</span>
              </div>
            </div>
            <p class="opt-one-liner">${item.oneLiner}</p>
            <div class="opt-meta-row">
              <span>원문 길이: ${item.originalLength}자 · 인지 부하: ${item.cognitiveLoad}</span>
              <button type="button" class="btn btn-xs ${isRec ? 'btn-accent' : 'btn-secondary'} select-opt-btn" data-opt="${item.index}">
                옵션 ${item.index} 채택하기
              </button>
            </div>
          `;
          listEl.appendChild(card);
        });

        listEl.querySelectorAll('.select-opt-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const chosenIdx = Number(btn.getAttribute('data-opt'));
            const chosenItem = result.items[chosenIdx - 1];
            const logChoiceSelect = document.getElementById('log-choice');
            if (logChoiceSelect) {
              logChoiceSelect.selectedIndex = chosenIdx === 2 ? 0 : (chosenIdx === 1 ? 1 : 2);
            }
            if (feedbackEl) {
              feedbackEl.innerHTML = `✅ <strong>[옵션 ${chosenIdx} 최종 채택 완료]</strong> 습관적 클릭 대신 1줄 요약(${chosenItem.oneLiner})과 위험도(${chosenItem.riskLevel})를 확인하고 합리적인 의사결정을 내렸습니다! (할 일 3의 모달 선택란에도 자동 반영됨)`;
            }
          });
        });
      }
    }

    const modalForm = document.getElementById('modal-analyzer-form');
    if (modalForm) {
      modalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        renderModalSummary(true);
      });
    }

    const btnClearOptions = document.getElementById('btn-clear-options');
    if (btnClearOptions) {
      btnClearOptions.addEventListener('click', () => {
        const o1 = document.getElementById('opt-input-1');
        const o2 = document.getElementById('opt-input-2');
        const o3 = document.getElementById('opt-input-3');
        if (o1) o1.value = '';
        if (o2) o2.value = '';
        if (o3) o3.value = '';
        renderModalSummary(true);
      });
    }

    document.querySelectorAll('.modal-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        hideGlobalGuard();
        loadModalScenario(btn.getAttribute('data-scenario'));
      });
    });

    // =========================================================================
    // [할 일 3] 구조화 프롬프트 생성기 & 36회 세션 실시간 비교
    // =========================================================================
    function renderStructuredPrompt(showGuardBanner) {
      const modEl = document.getElementById('pb-module');
      const minEl = document.getElementById('pb-debug-min');
      const errEl = document.getElementById('pb-error-log');
      const uxEl = document.getElementById('pb-ux-goal');
      const outEl = document.getElementById('generated-prompt-output');
      const guardMsg = document.getElementById('prompt-guard-msg');

      const res = buildStructuredPrompt(
        modEl ? modEl.value : '',
        minEl ? minEl.value : 10,
        errEl ? errEl.value : '',
        uxEl ? uxEl.value : ''
      );

      if (res.guardTriggered) {
        if (guardMsg) {
          guardMsg.textContent = `🛡️ [${res.guardReason}]`;
          guardMsg.classList.remove('hidden');
        }
        if (showGuardBanner) {
          showGlobalGuard('할 일 3 — 프롬프트 생성기 입력 자동 보정 완료', res.guardReason);
        }
      } else if (guardMsg) {
        guardMsg.classList.add('hidden');
      }

      if (outEl) outEl.textContent = res.promptText;
      return res;
    }

    const promptForm = document.getElementById('prompt-builder-form');
    if (promptForm) {
      promptForm.addEventListener('submit', (e) => {
        e.preventDefault();
        renderStructuredPrompt(true);
      });
    }

    const btnCopyPrompt = document.getElementById('btn-copy-prompt');
    if (btnCopyPrompt) {
      btnCopyPrompt.addEventListener('click', () => {
        const res = renderStructuredPrompt(false);
        const statusEl = document.getElementById('gp-copy-status');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(res.promptText).then(() => {
            if (statusEl) statusEl.textContent = '✅ 클립보드에 복사되었습니다!';
          }).catch(() => {
            if (statusEl) statusEl.textContent = '✅ 아래 텍스트를 선택해 복사하세요.';
          });
        }
      });
    }

    // 36회 원자료 + 사용자 세션 테이블 렌더링
    function renderSessionTable() {
      const filterSelect = document.getElementById('table-zone-filter');
      const filterVal = filterSelect ? filterSelect.value : 'all';
      const tbody = document.getElementById('session-table-body');

      const stats = computeDatasetStats(sessions);
      const totalEl = document.getElementById('comp-total-count');
      const addedEl = document.getElementById('comp-added-count');
      const inspectEl = document.getElementById('comp-inspect-rate');
      const middleEl = document.getElementById('comp-middle-rate');

      if (totalEl) totalEl.textContent = `${stats.totalCount}건`;
      if (addedEl) addedEl.textContent = `논문 36건 + 사용자 추가 ${stats.addedCount}건`;
      if (inspectEl) inspectEl.textContent = stats.inspectRateOver16;
      if (middleEl) middleEl.textContent = stats.middleBiasRate;

      if (!tbody) return;
      tbody.innerHTML = '';

      const filtered = sessions.slice().reverse().filter(s => {
        if (filterVal === 'short') return s.sec <= 15;
        if (filterVal === 'mid') return s.sec >= 16 && s.sec <= 30;
        if (filterVal === 'long') return s.sec >= 31;
        return true;
      });

      filtered.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>#${s.id}</td>
          <td>${s.task}</td>
          <td><strong>${s.sec}초</strong></td>
          <td>${s.action}</td>
          <td>${s.polling}</td>
          <td>${s.choice}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    const filterSelect = document.getElementById('table-zone-filter');
    if (filterSelect) {
      filterSelect.addEventListener('change', renderSessionTable);
    }

    const sessionForm = document.getElementById('session-log-form');
    if (sessionForm) {
      sessionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const secInput = document.getElementById('log-sec');
        const actionSelect = document.getElementById('log-action');
        const choiceSelect = document.getElementById('log-choice');
        const taskInput = document.getElementById('input-task-name');
        const guardMsg = document.getElementById('session-guard-msg');

        const diag = diagnoseLatency(
          secInput ? secInput.value : 30,
          taskInput ? taskInput.value : '[사용자 추가 세션]'
        );

        if (diag.guardTriggered) {
          if (guardMsg) {
            guardMsg.textContent = `🛡️ [세션 기록 입력 방어] ${diag.guardReason}`;
            guardMsg.classList.remove('hidden');
          }
          showGlobalGuard('할 일 3 — 세션 대기 시간 자동 보정 완료', diag.guardReason);
        } else if (guardMsg) {
          guardMsg.classList.add('hidden');
        }

        const newId = sessions.length + 1;
        const actionVal = actionSelect ? actionSelect.value : '혼밥비서 화면 검수';
        const choiceVal = choiceSelect ? choiceSelect.value : '2번째 옵션';
        const pollingVal = diag.sanitizedSec >= 16 ? '무폴링 타이머로 시선분산 방어(0회)' : '해당없음';

        sessions.push({
          id: newId,
          date: '실시간 추가',
          task: diag.sanitizedTask,
          sec: diag.sanitizedSec,
          action: actionVal,
          polling: pollingVal,
          choice: choiceVal,
          memo: 'FocusGuard AI 워크벤치에서 기록됨'
        });

        renderSessionTable();
      });
    }

    // CSV 다운로드
    const btnExportCsv = document.getElementById('btn-export-csv');
    if (btnExportCsv) {
      btnExportCsv.addEventListener('click', () => {
        const header = 'ID,Date,Honbab_Task,Latency_Sec,Action_Type,Visual_Polling,Modal_Choice,Memo\n';
        const rows = sessions.map(s =>
          `${s.id},${s.date},"${String(s.task).replace(/"/g, '""')}",${s.sec},${s.action},${s.polling},${s.choice},"${String(s.memo || '').replace(/"/g, '""')}"`
        ).join('\n');
        const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `focusguard_sessions_${sessions.length}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    // =========================================================================
    // [BRB-C05] 상단 원클릭 잘못된 입력 방어 스트레스 테스트 버튼
    // =========================================================================
    document.querySelectorAll('.btn-edge, [data-edge="reset"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const edgeType = btn.getAttribute('data-edge');
        const secInput = document.getElementById('input-latency-sec');
        const taskInput = document.getElementById('input-task-name');

        if (edgeType === 'empty') {
          if (secInput) secInput.value = '';
          renderLatencyDiagnosis(true);
        } else if (edgeType === 'negative') {
          if (secInput) secInput.value = '-45';
          renderLatencyDiagnosis(true);
        } else if (edgeType === 'nan') {
          if (secInput) secInput.value = 'abc오류<script>';
          renderLatencyDiagnosis(true);
        } else if (edgeType === 'huge') {
          if (secInput) secInput.value = '99999';
          renderLatencyDiagnosis(true);
        } else if (edgeType === 'empty-modal') {
          const o1 = document.getElementById('opt-input-1');
          const o2 = document.getElementById('opt-input-2');
          const o3 = document.getElementById('opt-input-3');
          if (o1) o1.value = '';
          if (o2) o2.value = '';
          if (o3) o3.value = '';
          renderModalSummary(true);
        } else if (edgeType === 'reset') {
          if (secInput) secInput.value = '25';
          if (taskInput) taskInput.value = '[반응형 UI] 모바일 뷰포트(375px) 냉장고 그리드 카드 깨짐 수정';
          hideGlobalGuard();
          renderLatencyDiagnosis(false);
          loadModalScenario('api');
          renderStructuredPrompt(false);
        }
      });
    });

    // 초기 화면 렌더링
    renderLatencyDiagnosis(false);
    loadModalScenario('api');
    renderStructuredPrompt(false);
    renderSessionTable();

    // 처음 온 사용자를 위한 원클릭 자동 시연 투어
    const btnAutoTour = document.getElementById('btn-auto-tour');
    const tourBanner = document.getElementById('tour-status-banner');
    if (btnAutoTour && tourBanner) {
      btnAutoTour.addEventListener('click', () => {
        hideGlobalGuard();
        tourBanner.classList.remove('hidden');
        const secInput = document.getElementById('input-latency-sec');
        if (secInput) secInput.value = '48';
        renderLatencyDiagnosis(false);
        loadModalScenario('dday');
        renderStructuredPrompt(false);

        const step1Section = document.getElementById('task-1');
        if (step1Section) {
          step1Section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        tourBanner.textContent = '✨ [자동 시연 완료] STEP 1(48초 복합 추론 진단) · STEP 2(3지선다 D-day 1줄 요약) · STEP 3(4줄 디버깅 프롬프트)가 모두 실행되었습니다! 아래에서 결과를 바로 확인해 보세요.';
      });
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initBrowserApp);
    } else {
      initBrowserApp();
    }
  }

  return {
    PAPER_RULES,
    INITIAL_SESSIONS_36,
    MODAL_SCENARIOS,
    diagnoseLatency,
    summarizeThreeOptions,
    buildStructuredPrompt,
    computeDatasetStats
  };
});

