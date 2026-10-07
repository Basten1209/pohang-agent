import { MapPin, ArrowUpRight } from "lucide-react";
import { mapUrl } from "../shared/model";
export function RouteMap() {
  return (
    <div className="route-map">
      <div className="map-heading">
        <span>
          <MapPin size={16} /> 오늘의 여행 동선
        </span>
        <span className="muted">방문 순서 · 실제 도로 아님</span>
      </div>
      <svg
        viewBox="0 0 740 258"
        role="img"
        aria-label="영일대에서 구룡포를 방문한 뒤 포항역으로 돌아오는 개념도"
      >
        <defs>
          <pattern
            id="grid"
            width="25"
            height="25"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 25 0 L 0 0 0 25"
              fill="none"
              stroke="#d8ded1"
              strokeWidth=".6"
            />
          </pattern>
        </defs>
        <rect width="740" height="258" fill="#edf0e5" />
        <rect width="740" height="258" fill="url(#grid)" />
        <path
          d="M190 -10 C180 50 245 80 240 120 S330 240 375 260 L740 260 L740 -10Z"
          fill="#d4e8e8"
        />
        <path
          d="M190 -10 C180 50 245 80 240 120 S330 240 375 260"
          fill="none"
          stroke="#b8d4d0"
          strokeWidth="3"
        />
        <path d="M380 258 Q472 193 547 190 T740 95 L740 258" fill="#e7ecdd" />
        <path
          d="M380 258 Q472 193 547 190 T740 95"
          fill="none"
          stroke="#b8d4d0"
          strokeWidth="3"
        />
        <g stroke="#fff" strokeWidth="7" fill="none">
          <path d="M46 0L90 82L74 200L188 258" />
          <path d="M0 98L165 105L219 169L343 250" />
          <path d="M472 258L550 216L688 212L740 168" />
        </g>
        <path
          d="M218 69 C295 69 296 188 571 204"
          stroke="#df835a"
          strokeWidth="3"
          strokeDasharray="7 7"
          fill="none"
        />
        <path
          d="M565 205 C390 182 272 244 104 140"
          stroke="#31565a"
          strokeWidth="3"
          strokeDasharray="7 7"
          fill="none"
        />
        <g fill="#819b9e" fontSize="13">
          <text x="432" y="80">
            영 일 만
          </text>
          <text x="275" y="155" fontSize="10">
            버스로 이동
          </text>
        </g>
        <g>
          <circle
            cx="218"
            cy="69"
            r="10"
            fill="#e89167"
            stroke="white"
            strokeWidth="4"
          />
          <rect x="180" y="24" width="79" height="27" rx="7" fill="white" />
          <text x="219" y="43" textAnchor="middle" fontSize="12" fill="#234348">
            영일대
          </text>
        </g>
        <g>
          <circle
            cx="104"
            cy="140"
            r="10"
            fill="#31565a"
            stroke="white"
            strokeWidth="4"
          />
          <rect x="56" y="160" width="96" height="27" rx="7" fill="white" />
          <text
            x="104"
            y="179"
            textAnchor="middle"
            fontSize="12"
            fill="#234348"
          >
            포항역 · 귀가
          </text>
        </g>
        <g>
          <circle
            cx="571"
            cy="204"
            r="17"
            fill="#31565a"
            stroke="white"
            strokeWidth="4"
          />
          <text x="571" y="209" textAnchor="middle" fontSize="13" fill="white">
            G
          </text>
          <rect x="528" y="157" width="87" height="27" rx="7" fill="white" />
          <text
            x="571"
            y="176"
            textAnchor="middle"
            fontSize="12"
            fill="#234348"
          >
            구룡포
          </text>
        </g>
      </svg>
      <a
        className="map-link"
        href={mapUrl("GURYONGPO")}
        target="_blank"
        rel="noreferrer"
      >
        카카오맵에서 위치 보기 <ArrowUpRight size={14} />
      </a>
    </div>
  );
}
