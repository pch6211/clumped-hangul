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

최종 회귀 수정과 CI는 `codex/motion-integration-20261003`에 모았다. main 병합·배포·릴리스는 수행하지 않는다.

## 검증

- PCH6211, Windows, Node 24, Chrome 154 임시 headless 프로필에서 UI 테스트 실행.
- 실제 inline JS 5개와 media-export.js에 문법 및 ESLint 제어 흐름·표현식 검사. 기존 HTML의 조기 return 뒤 보관된 코드에 대한 `no-unreachable`만 제외했다. 정적 앱으로 타입체커·번들 빌드는 적용 대상이 아니다.
- 음수 자간 키보드/숫자 입력, 글자 이동, 25회 리셋, 골격 재생성, pointercancel, 기존 획 드래그 통과.
- 바람·떨림을 끈 뒤 기준점 잔차 0.001px 미만. 설정 SAVE/LOAD로 중심 배치 복원.
- 왕복 변조 양 끝·한 주기·원래 값 복원·직접 변경 시 정지·잘못된 입력 처리·구조 변수 변조 검증.
- MOV 녹화 중 효과 변경과 10회 리셋, 변조 연동 정지, 취소 시 다운로드 없음, 자동 정지, 배경 포함 WebM 녹화 통과.
- MOV 구조 단위 테스트: sample offset·크기·가변 프레임 시간·입력 한도. 실제 다운로드를 FFmpeg로 전체 디코딩하고 첫 프레임의 투명/불투명/부분 알파를 확인한다. ProRes 4444 변환 후 알파도 다시 확인한다.
- 원형/둥근형/사각형 × 일반/테두리 6가지에서 영역 제한 결과를 전체 화면 처리와 비교: RGBA 차이 0. 초기 테두리 비교의 반올림 차이는 빈 영역 크기에 따라 마스크의 GPU/CPU 경로가 달라지면서 발생했다. `willReadFrequently`로 동일한 픽셀 처리 경로를 사용해 해결했다.
- GitHub Actions의 Review checks는 같은 lint/check/test 및 FFmpeg 검증을 수행하고 결과 파일을 artifact로 남긴다. 배포 작업은 없다.

### 성능 측정 범위

1280×720, 고정 seed, `뭉친 한글`, 부드럽게 5, 점 20/획 12, 슈퍼샘플 2.
15회 draw 중 워밍업 3회 제외 중앙값: 기존 `512753b` 229.5ms, 최종 로컬 실행 11.5ms.
마스크 3,686,400 → 168,600 픽셀. 동일 조건의 이 기기 측정이며 모든 문구·효과의 fps를 보장하는 수치는 아니다.
화면을 꽉 채운 긴 문구나 높은 분할에서는 절감 폭이 줄어든다. 실제 녹화는 최대 15fps이며 부하가 높으면 프레임 수가 줄고 각 프레임의 지속 시간으로 녹화 길이를 보존한다.

## 영상 형식과 제한

| 형식 | 구현 및 확인 | 제한 |
|---|---|---|
| MOV / PNG | RGBA PNG 프레임을 QuickTime 컨테이너에 저장. FFmpeg 실제 디코딩에서 배경 알파 0과 글자 알파 255/중간값 확인 | 무손실이므로 큰 파일. 브라우저 재생 및 모든 편집기의 수용을 보장하지 않음 |
| WebM / VP8 투명 | 앱 시작 시 실제 인코딩·중간 프레임 디코딩으로 투명 배경과 보이는 전경을 함께 확인한 경우에만 노출. 별도 Chrome 154 기능 검사에서 배경 0/전경 255 확인 | 환경에 따라 probe가 실패할 수 있으며 이 경우 MOV만 사용. 편집기 호환성은 별도 확인 필요 |
| 일반 WebM / MP4 | MediaRecorder 지원 형식 중 WebM 우선, 배경 포함. 인코딩 오류 시 자원 정리 및 MOV 대안 안내 | MIME 지원 응답만으로 실제 인코딩 성공이나 투명을 보장하지 않음. 이 기기의 MP4/H.264 probe는 실패했으므로 MP4를 검증 완료로 표시하지 않음 |
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
