# 점간격 랜덤 계산 조사 (2026-10-07)

현재 적응식은 변경하지 않았다. 수동 슬라이더는 0–120이며 숫자 직접 입력과 LOAD는 120 초과를 보존한다.

## 실제 계산

`visibleCharCount()`의 N은 공백과 개행을 제외한 Unicode 코드포인트 수(최소 1)이다. 실제 글리프 점/획 수를 세거나 한글/영문/복합 모임꼴별 가중치를 주지는 않는다.

`idealPointDistMax()`:

- W = max(200, cssW − 설정창 폭 − 문자창 폭), H = max(200, cssH − 하단 입력창 높이).
- hSub = 초성/중성/종성 너비 분할값 합 + 임의 획 추가값.
- vSub = 초성/중성/종성 높이 분할값 합 + 임의 획 추가값.
- A = (2 + hSub × lsHorizFactor) × (3.5 + vSub × lhVertFactor).
- U = clamp(4, 60, round(sqrt(W × H × idealAreaRatio / (N × A)))).
- 현재 소스 기본값: lsHorizFactor=0.4, lhVertFactor=0.2, idealAreaRatio=1.25. 관리자 저장값이 있으면 덮어쓸 수 있다. 코드의 `||` 대체값과 현재 기본값은 다르므로 혼동하면 안 된다.

`randomizeAll()`은 글자 수로 점 크기/획 굵기 상한 C=clamp(5,30,round(28−5log10(N)))를 정한다. nodeR는 1..C, lineW는 0..C에서 선택한다.

점간격은 L=max(4,round(U×0.25)), S=round(L+(U−L)×sizeProfile), R=ceil(max(nodeR,lineW)×4/3)를 사용해 max(L,min(U,max(S,R)))로 선택한다. sizeProfile은 0..1 비선형 난수다.

골격 복잡도도 별도로 N에 따라 조절한다. looseFactor를 글자 수 구간별로 정하고, tierMax=clamp(1,tierMaxBase,ceil(tierMaxBase−tierMaxSlope×(log10(N)−log10(looseFactor)))), tierActive=clamp(2,3,round(5−tierActiveSlope×(log10(N)−log10(looseFactor))))를 구한다. 현재 기본 tierMaxBase=5, tierMaxSlope=4, tierActiveSlope=4, looseBoost=1. tierMax×tierActive의 예산을 6개 골격 슬라이더 중 5개에 분배하고, randomExtra는 0..tierMax로 선택한다.

## 경로와 한계

- 전체 R, 시작 직후 랜덤, 초기화 후 시작, 자동재생 `toggleAuto()`의 즉시 실행 및 5초 간격 실행은 `randomizeAll()`을 사용한다.
- `makeGroupRandomizer()`의 간격 그룹은 일반 슬라이더 범위에서 균등 선택한다. 현재 pointDist는 0..120이다. 위 적응식은 사용하지 않는다.
- 전체 랜덤은 점간격을 먼저 계산하고 그 뒤 새 골격 분할을 생성한다. 따라서 U 계산에 쓰인 분할값은 직전 상태의 값일 수 있다.
- `ensureFits()`의 optical-v2 경로는 실제 배치 높이와 화면 높이×fitsThreshold(기본 0.65)를 비교한다. 글자 간격/행간을 줄이고 점간격은 직접 줄이지 않는다. legacy 경로는 마지막 단계에 점간격도 축소한다.
- 현재 코드에는 실제 글자의 점/획 개수나 문자 종류별 복잡도를 점간격 난수 범위에 직접 넣는 계산이 없다. 실제 형태는 optical 배치 측정에 간접 반영된다.

## 제안 (미적용)

우선 기존 적응식과 분할 예산은 유지하는 편이 맞다. 상한 60→120 변경, 새 골격을 뽑은 뒤 상한 계산, 간격 그룹 주사위에도 같은 계산 적용은 각각 별도 동작 변경이다. 사용자의 조사 요청에 따라 확정하지 않았다. 실제 점/획 수를 추가하는 새 적응형 알고리즘도 미설계·미적용 상태다.
