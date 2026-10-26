import type { ReactNode } from "react";
import { Platform } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";

import { useRokloTheme } from "@/hooks/use-roklo-theme";

export type AuthArtName = "welcome" | "inbox" | "broadcast" | "note";

type Palette = ReturnType<typeof useRokloTheme>["colors"];

const ACCENT = "#F5B83D";

type Hair = "short" | "bun" | "long";
type Person = { skin: string; hair: string; bg: string; style: Hair };

const PEOPLE: Record<string, Person> = {
  maria: { skin: "#F2C4A0", hair: "#3B2A20", bg: "#BFE7D6", style: "bun" },
  rahul: { skin: "#C98F63", hair: "#1F1A17", bg: "#F6D3C9", style: "short" },
  lisa: { skin: "#E8B48C", hair: "#7A4A25", bg: "#F8E2A9", style: "long" },
  sam: { skin: "#F5D0B0", hair: "#B8793A", bg: "#CFE3F7", style: "short" },
};

/** A flat, shading-free round avatar. */
function Avatar({
  id,
  cx,
  cy,
  r,
  person,
  ring,
}: {
  id: string;
  cx: number;
  cy: number;
  r: number;
  person: Person;
  ring: string;
}) {
  const hr = r * 0.36;
  const headY = cy - r * 0.12;
  const clip = `clip-${id}`;
  return (
    <G>
      <Defs>
        <ClipPath id={clip}>
          <Circle cx={cx} cy={cy} r={r} />
        </ClipPath>
      </Defs>
      <Circle cx={cx} cy={cy} r={r + 2} fill={ring} />
      <Circle cx={cx} cy={cy} r={r} fill={person.bg} />
      <G clipPath={`url(#${clip})`}>
        <Ellipse
          cx={cx}
          cy={cy + r * 0.88}
          rx={r * 0.64}
          ry={r * 0.5}
          fill={person.hair}
          opacity={0.9}
        />
        {person.style === "long" && (
          <Ellipse
            cx={cx}
            cy={headY + hr * 0.4}
            rx={hr * 1.2}
            ry={hr * 1.55}
            fill={person.hair}
          />
        )}
        <Circle cx={cx} cy={headY} r={hr} fill={person.skin} />
        {person.style === "bun" && (
          <Circle
            cx={cx}
            cy={headY - hr - hr * 0.3}
            r={hr * 0.42}
            fill={person.hair}
          />
        )}
        <Path
          d={`M ${cx - hr} ${headY} A ${hr} ${hr} 0 0 1 ${cx + hr} ${headY} Q ${cx} ${headY - hr * 0.55} ${cx - hr} ${headY} Z`}
          fill={person.hair}
        />
      </G>
    </G>
  );
}

/** White card with a very soft, flat drop shadow. */
function Card({
  x,
  y,
  w,
  h,
  r = 12,
  fill,
  shadow,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  fill: string;
  shadow: string;
  children?: ReactNode;
}) {
  return (
    <G>
      <Rect
        x={x}
        y={y + 3}
        width={w}
        height={h}
        rx={r}
        fill={shadow}
        opacity={0.07}
      />
      <Rect x={x} y={y} width={w} height={h} rx={r} fill={fill} />
      {children}
    </G>
  );
}

function Bar({
  x,
  y,
  w,
  h = 5,
  fill,
  opacity,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  fill: string;
  opacity?: number;
}) {
  return (
    <Rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={h / 2}
      fill={fill}
      opacity={opacity}
    />
  );
}

function Sparkle({ cx, cy, s = 9 }: { cx: number; cy: number; s?: number }) {
  const k = s * 0.28;
  return (
    <Path
      d={`M ${cx} ${cy - s} Q ${cx + k} ${cy - k} ${cx + s} ${cy} Q ${cx + k} ${cy + k} ${cx} ${cy + s} Q ${cx - k} ${cy + k} ${cx - s} ${cy} Q ${cx - k} ${cy - k} ${cx} ${cy - s} Z`}
      fill={ACCENT}
    />
  );
}

function DoubleTick({
  x,
  y,
  color,
}: {
  x: number;
  y: number;
  color: string;
}) {
  return (
    <Path
      d={`M ${x} ${y} l 3 3 l 6 -7 M ${x + 5} ${y} l 3 3 l 6 -7`}
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

/** Tall rounded phone with the darker header bar, search and filter icons. */
function Phone({
  p,
  top = 14,
  height = 212,
  header = true,
}: {
  p: Palette;
  top?: number;
  height?: number;
  header?: boolean;
}) {
  return (
    <G>
      <Rect
        x={100}
        y={top}
        width={120}
        height={height}
        rx={22}
        fill={p["brand-300"]}
      />
      {header && (
        <G>
          <Rect
            x={108}
            y={top + 8}
            width={104}
            height={26}
            rx={13}
            fill={p["brand-500"]}
          />
          <Bar x={119} y={top + 15} w={38} h={4} fill="#FFFFFF" />
          <Bar x={119} y={top + 23} w={26} h={4} fill="#FFFFFF" opacity={0.8} />
          <Circle
            cx={183}
            cy={top + 20}
            r={4.2}
            stroke="#FFFFFF"
            strokeWidth={1.4}
            fill="none"
          />
          <Line
            x1={186}
            y1={top + 23}
            x2={188.5}
            y2={top + 25.5}
            stroke="#FFFFFF"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
          <Path
            d={`M 195 ${top + 16} h 10 l -4 5 v 5 l -2 -1.4 v -3.6 z`}
            stroke="#FFFFFF"
            strokeWidth={1.3}
            strokeLinejoin="round"
            fill="none"
          />
        </G>
      )}
    </G>
  );
}

function InboxCard({
  id,
  p,
  x,
  y,
  w,
  label,
  owner,
  assignee,
}: {
  id: string;
  p: Palette;
  x: number;
  y: number;
  w: number;
  label: string;
  owner: Person;
  assignee: Person;
}) {
  const h = 46;
  // The assignee avatar follows the label; ~4.2px per character at size 8.
  const labelX = x + 36;
  const assigneeX = labelX + label.length * 4.3 + 11;
  return (
    <Card x={x} y={y} w={w} h={h} fill={p.card} shadow={p["ink-900"]}>
      <Avatar
        id={`${id}-a`}
        cx={x + 20}
        cy={y + 19}
        r={11}
        person={owner}
        ring={p.card}
      />
      <Bar x={labelX} y={y + 9} w={22} h={4} fill={p["ink-200"]} />
      <SvgText
        x={labelX}
        y={y + 24}
        fontSize={8}
        fontWeight="600"
        fill={p["ink-900"]}
      >
        {label}
      </SvgText>
      <Avatar
        id={`${id}-b`}
        cx={assigneeX}
        cy={y + 21}
        r={5}
        person={assignee}
        ring={p.card}
      />
      <Line
        x1={x + 8}
        x2={x + w - 8}
        y1={y + 33}
        y2={y + 33}
        stroke={p["ink-200"]}
        strokeWidth={0.8}
      />
      <Bar x={x + 12} y={y + 37} w={w * 0.34} h={3.5} fill={p["ink-200"]} />
    </Card>
  );
}

function Inbox({ p }: { p: Palette }) {
  return (
    <G>
      <Phone p={p} />
      <InboxCard
        id="in1"
        p={p}
        x={54}
        y={56}
        w={142}
        label="Assigned to Maria"
        owner={PEOPLE.sam}
        assignee={PEOPLE.maria}
      />
      <InboxCard
        id="in2"
        p={p}
        x={130}
        y={112}
        w={138}
        label="Assigned to Rahul"
        owner={PEOPLE.maria}
        assignee={PEOPLE.rahul}
      />
      <InboxCard
        id="in3"
        p={p}
        x={64}
        y={170}
        w={136}
        label="Assigned to Lisa"
        owner={PEOPLE.rahul}
        assignee={PEOPLE.lisa}
      />
      <Sparkle cx={262} cy={46} />
    </G>
  );
}

function Welcome({ p }: { p: Palette }) {
  const dash = {
    stroke: p["brand-500"],
    strokeWidth: 1.5,
    strokeDasharray: "3 4",
    strokeLinecap: "round" as const,
    opacity: 0.7,
  };
  return (
    <G>
      <Line x1={74} y1={72} x2={104} y2={86} {...dash} />
      <Line x1={246} y1={112} x2={214} y2={118} {...dash} />
      <Line x1={76} y1={178} x2={106} y2={170} {...dash} />
      <Phone p={p} />
      <Card x={114} y={58} w={80} h={40} fill={p.card} shadow={p["ink-900"]}>
        <Bar x={124} y={69} w={52} h={5} fill={p["ink-200"]} />
        <Bar x={124} y={80} w={34} h={5} fill={p["ink-200"]} />
      </Card>
      <Card
        x={126}
        y={108}
        w={84}
        h={40}
        fill={p["brand-600"]}
        shadow={p["ink-900"]}
      >
        <Bar x={136} y={119} w={50} h={5} fill="#FFFFFF" opacity={0.9} />
        <Bar x={136} y={130} w={32} h={5} fill="#FFFFFF" opacity={0.65} />
        <DoubleTick x={188} y={137} color="#FFFFFF" />
      </Card>
      <Card x={114} y={158} w={62} h={32} fill={p.card} shadow={p["ink-900"]}>
        <Bar x={124} y={168} w={40} h={5} fill={p["ink-200"]} />
        <Bar x={124} y={178} w={24} h={5} fill={p["ink-200"]} />
      </Card>
      <Avatar
        id="w1"
        cx={56}
        cy={64}
        r={18}
        person={PEOPLE.maria}
        ring={p.card}
      />
      <Avatar
        id="w2"
        cx={264}
        cy={112}
        r={18}
        person={PEOPLE.rahul}
        ring={p.card}
      />
      <Avatar
        id="w3"
        cx={58}
        cy={184}
        r={18}
        person={PEOPLE.lisa}
        ring={p.card}
      />
      <Sparkle cx={252} cy={42} />
    </G>
  );
}

function Broadcast({ p }: { p: Palette }) {
  return (
    <G>
      <Phone p={p} top={40} height={220} header={false} />
      <Card x={108} y={84} w={104} h={110} fill={p.card} shadow={p["ink-900"]}>
        <Rect
          x={116}
          y={92}
          width={88}
          height={62}
          rx={8}
          fill={p["brand-100"]}
        />
        <Rect
          x={146}
          y={102}
          width={28}
          height={28}
          rx={7}
          fill={p["brand-500"]}
        />
        <Circle cx={165} cy={111} r={3} fill="#FFFFFF" />
        <Path d="M 150 126 l 8 -10 l 5 6 l 3 -3 l 5 7 z" fill="#FFFFFF" />
        <Bar x={116} y={163} w={62} h={6} fill={p["ink-200"]} />
        <Bar x={116} y={175} w={40} h={6} fill={p["ink-200"]} />
      </Card>
      <Card x={66} y={18} w={188} h={46} fill={p.card} shadow={p["ink-900"]}>
        <Avatar
          id="b1"
          cx={90}
          cy={41}
          r={11}
          person={PEOPLE.rahul}
          ring={p.card}
        />
        <Avatar
          id="b2"
          cx={106}
          cy={44}
          r={11}
          person={PEOPLE.maria}
          ring={p.card}
        />
        <SvgText
          x={128}
          y={38}
          fontSize={10}
          fontWeight="700"
          fill={p["ink-900"]}
        >
          Broadcast
        </SvgText>
        <SvgText x={128} y={51} fontSize={8} fill={p["ink-600"]}>
          2,317 contacts
        </SvgText>
      </Card>
      <Path
        d="M 232 118 L 278 100 L 254 146 L 247 128 Z"
        fill={ACCENT}
        strokeLinejoin="round"
      />
      <Path d="M 247 128 L 278 100 L 252 134 Z" fill="#E09B1E" />
      <Avatar
        id="b3"
        cx={52}
        cy={128}
        r={16}
        person={PEOPLE.lisa}
        ring={p.card}
      />
      <Avatar
        id="b4"
        cx={268}
        cy={188}
        r={16}
        person={PEOPLE.sam}
        ring={p.card}
      />
    </G>
  );
}

function Note({ p }: { p: Palette }) {
  return (
    <G>
      <Phone p={p} />
      <Card x={114} y={56} w={82} h={36} fill={p.card} shadow={p["ink-900"]}>
        <Bar x={124} y={66} w={54} h={5} fill={p["ink-200"]} />
        <Bar x={124} y={77} w={34} h={5} fill={p["ink-200"]} />
      </Card>
      <Card
        x={124}
        y={100}
        w={88}
        h={36}
        fill={p["brand-600"]}
        shadow={p["ink-900"]}
      >
        <Bar x={134} y={110} w={52} h={5} fill="#FFFFFF" opacity={0.9} />
        <Bar x={134} y={121} w={32} h={5} fill="#FFFFFF" opacity={0.65} />
        <DoubleTick x={190} y={129} color="#FFFFFF" />
      </Card>
      <Rect
        x={86}
        y={150}
        width={150}
        height={64}
        rx={12}
        fill={p["warning-solid"]}
        opacity={0.07}
        transform="translate(0 3)"
      />
      <Rect
        x={86}
        y={150}
        width={150}
        height={64}
        rx={12}
        fill={p["warning-pill-bg"]}
        stroke={p["warning-solid"]}
        strokeWidth={1}
        strokeOpacity={0.5}
      />
      <Rect
        x={98}
        y={165}
        width={14}
        height={11}
        rx={3}
        fill={p["warning-solid"]}
      />
      <Path
        d="M 101 165 v -3 a 4 4 0 0 1 8 0 v 3"
        stroke={p["warning-solid"]}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
      />
      <SvgText
        x={120}
        y={174}
        fontSize={9}
        fontWeight="700"
        fill={p["warning-pill-fg"]}
      >
        Private note
      </SvgText>
      <Bar x={98} y={186} w={104} h={4} fill={p["warning-solid"]} opacity={0.35} />
      <Bar x={98} y={196} w={64} h={4} fill={p["warning-solid"]} opacity={0.35} />
      <Avatar
        id="n1"
        cx={236}
        cy={152}
        r={13}
        person={PEOPLE.maria}
        ring={p.card}
      />
      <Sparkle cx={54} cy={60} s={8} />
    </G>
  );
}

const SCENES: Record<AuthArtName, (props: { p: Palette }) => ReactNode> = {
  welcome: Welcome,
  inbox: Inbox,
  broadcast: Broadcast,
  note: Note,
};

/**
 * Simple flat illustration for the login carousel: UI cards, placeholder bars
 * and small avatars. Colors come from theme tokens, so it follows dark mode.
 */
export function AuthArt({ name }: { name: AuthArtName }) {
  const { colors } = useRokloTheme();
  const Scene = SCENES[name];
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 320 240"
      preserveAspectRatio="xMidYMid meet"
      {...(Platform.OS === "web"
        ? { "aria-hidden": true }
        : { accessible: false })}
    >
      <Scene p={colors} />
    </Svg>
  );
}
