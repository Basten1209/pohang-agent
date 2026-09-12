# RUN2구룡포 참가신청서 빌드

공식 양식(`form-template.docx`)에 `sections/sec1..5.json`(개조식 블록)을 조판해
`docs/submission/RUN2구룡포-팀명미입력.docx`를 생성한다.

```bash
pip install python-docx lxml pillow          # 최초 1회
python3 docs/submission/build/build_docx.py  # docx 생성
```

- 붙임 1: 양식의 파란/회색 안내 문구를 제거하고 프로젝트명만 채운다. 팀 정보·서명은 제출 전 직접 입력.
- 붙임 2: 안내 문구·예시 상자를 제거하고 본문을 페이지 테두리 구역으로 조판한다(맑은 고딕 11pt, 그림 4장은 `docs/assets/run2-guryongpo/`에서 삽입).
- 붙임 3: 원본 그대로.
- 섹션 JSON 형식 검사: `python3 docs/submission/build/validate_section.py docs/submission/build/sections/sec3.json`
- PDF 확인: `soffice --headless --convert-to pdf docs/submission/RUN2구룡포-팀명미입력.docx`
