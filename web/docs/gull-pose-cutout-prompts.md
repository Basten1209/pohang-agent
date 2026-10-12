# 갈매기 포즈별 투명 에셋

2026-10-11. Built-in `image_gen` 도구로 사용자 제공 `public/images/brand/gull-poses.png`의 지도/생각/축하 포즈를 각각 분리하고 배경을 제거했다. 기존 인사 포즈는 그대로 유지했다. 네 포즈 모두 독립된 투명 PNG이며 CSS 스프라이트 크롭을 사용하지 않는다.

최종 파일: `public/images/brand/gull-{map,think,cheer}-transparent.png`. 생성 alpha 채널을 그대로 보존했다.

## 최종 프롬프트

### map

Use case: background-extraction. Edit target: the supplied RUN2 seagull four-pose reference sheet. Extract ONLY the THIRD seagull from the left, holding the unfolded turquoise map in both wings into ONE standalone transparent PNG for the RUN2구룡포 web app. Preserve exactly the existing plush 3D character design, white feathers, facial features, proportions, small feather tuft, teal-and-white athletic headband, navy wing tips and running shoes. Preserve the map-holding pose, map colors and printed path, smiling expression, and both feet planted. Remove ALL other characters and all white/off-white backdrop and ground shadow. Actual transparent alpha, not a white background or drawn checkerboard. The entire selected character including every wing tip, head tuft, both complete shoes and all accessories must be comfortably inside a square canvas with an even transparent safety margin of approximately 10 percent. No cropping, no neighboring body parts, no card, no frame, no text, no new accessories, no redesign. Clean soft feather edges with no white matte.

### think

Use case: background-extraction. Edit target: the supplied RUN2 seagull four-pose reference sheet. Extract ONLY the SECOND seagull from the left, thinking with one wing touching its chin into ONE standalone transparent PNG for the RUN2구룡포 web app. Preserve exactly the existing plush 3D character design, white feathers, facial features, proportions, small feather tuft, teal-and-white athletic headband, navy wing tips and running shoes. Preserve the thoughtful expression, wing resting under the beak, and both feet planted. Remove ALL other characters and all white/off-white backdrop and ground shadow. Actual transparent alpha, not a white background or drawn checkerboard. The entire selected character including every wing tip, head tuft, both complete shoes and all accessories must be comfortably inside a square canvas with an even transparent safety margin of approximately 10 percent. No cropping, no neighboring body parts, no card, no frame, no text, no new accessories, no redesign. Clean soft feather edges with no white matte.

### cheer

Use case: background-extraction. Edit target: the supplied RUN2 seagull four-pose reference sheet. Extract ONLY the FOURTH / RIGHTMOST seagull, cheering with both wings raised and one shoe lifted into ONE standalone transparent PNG for the RUN2구룡포 web app. Preserve exactly the existing plush 3D character design, white feathers, facial features, proportions, small feather tuft, teal-and-white athletic headband, navy wing tips and running shoes. Preserve the happy closed-eye smile, both wings raised, and one lifted foot. Remove ALL other characters and all white/off-white backdrop and ground shadow. Actual transparent alpha, not a white background or drawn checkerboard. The entire selected character including every wing tip, head tuft, both complete shoes and all accessories must be comfortably inside a square canvas with an even transparent safety margin of approximately 10 percent. No cropping, no neighboring body parts, no card, no frame, no text, no new accessories, no redesign. Clean soft feather edges with no white matte.
