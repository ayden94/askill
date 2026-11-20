---
name: askill-review-head
description: Review one exact head with three independent mandatory axes and optional installed Open Code Review.
---

# Review an exact head

리드는 실제 diff를 승인된 계약과 대조한다. 세 독립 읽기 전용 리뷰어에게 동일한 기준 SHA, head SHA, 계약 digest, diff, 검증 증거를 전달한다. 구현자는 자신의 작업을 독립 판정하지 않는다.

- **계약:** 변경·유지 조건 및 범위를 충족했는가?
- **코드 품질:** 실제 호출부와 저장소 관례에서 정확성과 회귀 위험은 어떤가?
- **검증 근거:** 각 완료 조건이 실행 결과와 관찰로 입증되는가?

리뷰어마다 [계약](references/contract.md), [코드 품질](references/code.md), [검증 근거](references/verification.md) 역할 문서 중 해당하는 하나만 전달한다. 세 역할을 같은 작업자에게 순차 배정하지 않는다.

리뷰 라운드 중 동일한 바인딩으로 `askill run-ocr`를 호출한다. OCR은 세 축을 대체하지 않는다. 실행 환경에 없으면 `skipped-uninstalled`로 기록하고 자동 설치하지 않는다. 설치되어 있고 제공자에 diff를 보낼 권한이 있으면 같은 base/head에 실행한다. 권한 부재와 실행 실패는 각각 별도로 기록한다. OCR 출력은 후보이며 실제 코드에서 확인한 결함만 수정 사유가 된다.

필수 축이 빠지거나 근거가 없으면 통과가 아니다. head나 승인 계약이 바뀌면 해당 조합의 3축 리뷰를 다시 수행한다.
