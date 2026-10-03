# 뭉친한글 v1.13-dev 검토 기록

기준: `main`의 `512753b`. 원본 Dropbox 사본은 수정하지 않고 독립 clone에서 작업했다.
기존 저장소에는 AGENTS.md, .agents/skills, package.json, 테스트·CI가 없었다.
작업 중 확인한 미커밋 수정은 이 작업 폴더의 보조 수정 스크립트 및 Codex 커밋 이력과 대조했고 보존했다.

## 브랜치 전략

단일 HTML에 여러 기능이 결합되어 있어 순차 커밋 및 누적 기능 브랜치로 검토 지점을 남겼다.
각 브랜치는 이전 기능을 포함하는 체크포인트다. 독립적으로 main에 각각 병합하는 용도가 아니다.

| 기능 | 체크포인트 커밋 | 브랜치 |
|---|---|---|
| 음수 수동 자간 | f66cb8a | codex/negative-spacing-20261003 |
| 글자 중심 배치 | c682282 | codex/letter-centers-20261003 |
| 바람·떨림 | fa0f18e | codex/restoring-motion-20261003 |
| 부드럽게 영역 최적화 | 5c711e5 | codex/smoothing-performance-20261003 |
| 왕복 변조 | f205683 | codex/parameter-modulation-20261003 |
| 투명 MOV 녹화 | 33fac76 | codex/transparent-recording-20261003 |

후속 UI·떨림 수정은 `1c72b1b`, 광학 자간 구현은 `codex/optical-spacing-20261003`에 별도 체크포인트를 남긴다.

최종 회귀 수정과 CI는 `codex/motion-integration-20261003`에 모았다. main 병합·배포·릴리스는 수행하지 않는다.

## 검증

- PCH6211, Windows, Node 24, Chrome 154 임시 headless 프로필에서 UI 테스트 실행.
- 실제 inline JS 5개와 media-export.js, motion-curve.js에 문법 및 ESLint 제어 흐름·표현식 검사. 기존 HTML의 조기 return 뒤 보관된 코드에 대한 `no-unreachable`만 제외했다. 정적 앱으로 타입체커·번들 빌드는 적용 대상이 아니다.
- 음수 자간 키보드/숫자 입력, 글자 이동, 25회 리셋, 골격 재생성, pointercancel, 기존 획 드래그 통과.
- 중심 핸들은 글자 전체 hover에 표시하고 원래 크기의 1.5배다. 기본 설정 막대는 기존 형태·조작을 유지한다. 시각적 자간을 기본으로 하고 전환 버튼을 제거했다. 구형 작업은 내부 호환 경로로 보존한다.
- 꾸밈 마지막은 떨림 강도/속도 두 슬라이더다. 속도는 `0.03×400^(speed/100)`Hz(0이면 위상 정지). 새 기본30은 약0.181Hz이며1은0.03185Hz,100은12Hz다. 감쇠 스프링의 주파수 응답을 보정해 속도별 진폭 변화를 줄였다. 120초 수치 시뮬레이션에서 강도100의 RMS는 각각7.03/6.76/7.43px, anchor 불변, 0속도 정지와 0강도 복원 잔차0.001px 미만이었다. 붙은 교점은 같은 변위를 공유한다. 구형 활성 떨림 저장 파일에 속도가 없으면100, 비활성은30으로 복원한다.
- 독립 `.mhDialog` 팝업 제목은 MOV다. 제목 아래 녹화/재생/정지는 테두리 영역 밖에 있고, 조작하는 선택목록·범위·그래프 영역에만 테두리가 있다. 내부7개 그룹 체크리스트에서 슬라이더를 추가하며 기본 설정창에는 선택 기능이 없다. 지정하지 않은 빈 구간은 재생에서 제외한다. 시간/횟수 입력은 관리자 팝업과 같은46px·1px 테두리 스타일이다. 왕복 변조 체크박스 없이 완성된 구간은 자동으로 녹화에 연동한다.
- 진행률 그래프는 높이를 절반으로 줄이고 선을 불투명1px로 통일했다. 접선은 기존 모임꼴/편집기 선택선의3px/3px 점선을 사용한다. 클릭으로 점을 추가하고 점·접선을 드래그/방향키로 편집한다. 경로 위에 점을 넣으면 de Casteljau 분할로 기존 곡선을 보존한다. 시간축 점·제어점 순서와 y범위0~1을 제한하여 역전/overshoot/NaN을 방지한다. 끝점은(0,0)/(1,1)로 고정하고 내부 점만 삭제한다.
- 접선을 점으로 접으면 해당 접선만 사라진다. 한 구간 양끝의 제어점이 접히면 직선이다. Shift+점 드래그는 접힌 쪽을 복원하며 둘 다 접혔으면 둘 다 꺼낸다. Enter는 키보드용 접기/복원이다. Ctrl Z/Ctrl Shift Z는 활성 MOV 창의 곡선 기록만 처리하고 빈 기록도 뒤 캔버스에 전달하지 않는다. 한 드래그는 한 단계, 취소는 기록 없이 복구한다. 다른 창·입력·IME 실행취소를 침범하지 않는 실제 UI 검증을 추가했다.
- 두 변수의 역방향 포함 구간을 왕복0.4초×3회로 재생해 7개 경계값을 정확히 확인했다. 정지 복원, 직접 변경 시 변조 정지, 잘못된 기간 거부, Space 일시정지/재개와 텍스트 입력·IME 보호, 곡선/범위 핸들 취소를 검증한다.
- 640×480 소형 MOV로 유한 반복 자동 저장·수동 정지·녹화 중 효과 변경/10회 리셋/창 크기 변경을 검증한다. 선택값 변경 중 녹화는 수동으로 계속하고 변조 재생으로 연동을 재개한다. Esc/닫기는 저장 없이 취소하고 열기 버튼으로 포커스를 돌린다. 첫 프레임은 같은 순간의 artwork 렌더와 RGBA 차이 0.
- 광학 자간은 독립 예상 윤곽·48개 높이 표본·문자쌍 여백을 사용한다. 구형 파일/브라우저 작업 보존, 이전 커밋의 6개 정확한 배치 fixture, 미래 버전 거부, 25회 리셋, 절대 중심, 구조 변조 중 배치 고정을 검증한다. 알고리즘과 조판 제한은 [SPACING-RESEARCH.md](SPACING-RESEARCH.md)에 정리했다.
- MOV 구조 단위 테스트: sample offset·크기·가변 프레임 시간·입력 한도. 실제 다운로드를 FFmpeg로 전체 디코딩하고 첫 프레임의 투명/불투명/부분 알파를 확인한다. ProRes 4444 변환 후 알파도 다시 확인한다.
- 원형/둥근형/사각형 × 일반/테두리 6가지에서 블러 영역 제한 결과를 전체 화면 처리와 비교: 로컬 RGBA 차이 0. 이전 커밋2436496은 Windows에서 통과했지만 Linux CI의 원형에서 4/10채널 차이로 실패했다. CPU 마스크 지정만으로는 부족했다. 네이티브 곡선 래스터화의 좌표/캔버스 크기를 고정하고 **블러 readback만 제한**하도록 수정했다. 테스트 허용 오차는 늘리지 않았다.
- GitHub Actions의 Review checks는 같은 lint/check/test 및 FFmpeg 검증을 수행하고 결과 파일을 artifact로 남긴다. 배포 작업은 없다.

### 성능 측정 범위

1280×720, 고정 seed, `뭉친 한글`, 부드럽게 5, 점 20/획 12, 슈퍼샘플 2.
15회 draw 중 워밍업 3회 제외 중앙값: 기존 `512753b` 229.5ms, 후속 수정 로컬 실행 17.6ms. 광학 자간 추가 후에도 비교용 성능 테스트는 기존 배치 모드로 고정한다.
블러 처리 3,686,400 → 약174,000 픽셀. 원본 마스크 캔버스 크기와 메모리는 유지한다. 같은 설정·뷰포트의 이 기기 측정이며 초기 노드 jitter에 따른 영역 차이가 있고 모든 문구·효과의 fps를 보장하는 수치는 아니다.
화면을 꽉 채운 긴 문구나 높은 분할에서는 절감 폭이 줄어든다. 실제 녹화는 최대 15fps이며 부하가 높으면 프레임 수가 줄고 각 프레임의 지속 시간으로 녹화 길이를 보존한다.

## 영상 형식과 제한

| 형식 | 구현 및 확인 | 제한 |
|---|---|---|
| MOV / PNG | RGBA PNG 프레임을 QuickTime 컨테이너에 저장. FFmpeg 실제 디코딩에서 배경 알파 0과 글자 알파 255/중간값 확인 | 무손실이므로 큰 파일. 브라우저 재생 및 모든 편집기의 수용을 보장하지 않음 |
| WebM / VP8 투명 | 이전 단계의 별도 Chrome154 실측에서 알파 확인. 후속 사용자 요청으로 UI와 녹화 경로에서 제거 | 진단용 `tests/capabilities.cjs` 및 probe만 남김. 제품 지원 형식은 MOV 하나 |
| 일반 WebM / MP4 | 후속 요청으로 제거. MP4/H.264 진단 probe는 이 기기에서 실패 | MIME 지원 응답만으로 실제 인코딩 성공이나 투명을 보장하지 않음 |
| MOV / ProRes 4444 | 아래 명령으로 MOV/PNG를 외부 변환하고 FFmpeg에서 알파 유지 확인 | 앱 내 직접 ProRes 인코딩은 제공하지 않음. Premiere/After Effects/Safari는 이 작업에서 직접 검증하지 않음 |

```sh
ffmpeg -i input.mov -c:v prores_ks -profile:v 4 -pix_fmt yuva444p10le output-prores4444.mov
```

녹화는 무음, 최대 30초·64MiB·긴 변 1920px. 배경·핸들은 투명 녹화에 들어가지 않는다.
시작 화면 영역을 고정하므로 그 밖으로 이동한 글자는 잘린다. 탭을 숨기면 종료·저장, 페이지를 떠나면 취소한다.
텍스트 변경 시 다른 문서로 취급하여 중심 배치를 비운다. 동일 텍스트의 재생성·리셋은 배치를 유지한다.

형식 근거: [Apple QuickTime File Format](https://developer.apple.com/documentation/quicktime-file-format),
[W3C Canvas Media Capture](https://www.w3.org/TR/mediacapture-fromelement/),
[Chrome의 WebM 알파 설명](https://developer.chrome.com/blog/alpha-transparency-in-chrome-video/).
이 문서의 지원 판정은 문서상의 가능성과 로컬의 실제 인코딩·디코딩 결과를 구분한다.

곡선 편집은 [W3C cubic Bézier 정의](https://www.w3.org/TR/css-easing-1/#cubic-bezier-easing-functions)의 시간→진행률을 여러 구간으로 확장했다. Y축은 속도가 아니다. 최대64점, 실행취소100단계로 제한한다. 그래프와 변조는 같은 평가 함수를 사용하고 녹화는 해당 순간의 artwork를 그린다. 핸들 복원은 [Inkscape 단축키](https://inkscape.org/doc/keys.html)의 Shift+드래그 사례를 참고했다. [Illustrator Anchor Point](https://helpx.adobe.com/illustrator/desktop/draw-shapes-and-paths/modify-paths/convert-anchor-points-on-a-path.html)도 점을 끌어 방향 핸들을 복원하지만 별도 도구 선택을 사용한다.

광학 자간은 코드포인트별 등록 geometry에 공통 적용한다. 예상 형태는 계산 횟수가 제한된 근사이며 결합문자·RTL·문맥 shaping은 구현하지 않았다. 기존 fallback 문자는 그대로 유지한다.
