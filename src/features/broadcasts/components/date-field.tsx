import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { useRokloTheme } from "@/hooks/use-roklo-theme";

const WEEK_HEADER = ["S", "M", "T", "W", "T", "F", "S"];
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
/** The month's days in weeks from Sunday, padded with nulls. */
function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from(
      { length: count },
      (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1),
    ),
  ];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

/**
 * A date, as the web's date picker: the field shows the picked day, and opens a month calendar inline under
 * it (no popovers on signed-in screens). Days before `min` can't be picked. `clearable` adds an X back to
 * the placeholder ("No end date").
 */
export function DateField({
  value,
  onChange,
  min,
  label,
  placeholder = "Pick a date",
  clearable,
  invalid,
  disabled,
}: {
  value: Date | null;
  onChange: (date: Date | null) => void;
  min: Date;
  /** What the date is, for screen readers ("Date", "Ends on"). */
  label: string;
  placeholder?: string;
  clearable?: boolean;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useRokloTheme();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfDay(value ?? min));
  const first = startOfDay(min);
  const today = startOfDay(new Date());
  const canGoBack =
    month.getFullYear() > first.getFullYear() ||
    (month.getFullYear() === first.getFullYear() && month.getMonth() > first.getMonth());
  const shift = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));
  const text = value?.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <View className="gap-2">
      <View
        className="min-h-12 flex-row items-center rounded-xl border bg-card"
        style={{ borderColor: invalid ? colors["error-solid"] : open ? colors.ring : colors.input }}
      >
        <MotionPressable
          role="button"
          accessibilityLabel={`${label}: ${text ?? placeholder}. ${open ? "Close" : "Open"} calendar`}
          accessibilityState={{ expanded: open, disabled: !!disabled }}
          disabled={disabled}
          onPress={() => {
            if (!open) setMonth(startOfDay(value ?? min));
            setOpen(!open);
          }}
          className="min-h-12 min-w-0 flex-1 flex-row items-center gap-2.5 py-2 pl-3.5 pr-2"
        >
          <CustomIcon as={CalendarDays} size={18} className="text-ink-600" />
          <CustomText
            numberOfLines={1}
            className={
              value
                ? "flex-1 text-[15px] text-foreground"
                : "flex-1 text-[15px] text-muted-foreground"
            }
          >
            {text ?? placeholder}
          </CustomText>
          {!(clearable && value) && (
            <CustomIcon as={ChevronDown} size={18} className="text-muted-foreground" />
          )}
        </MotionPressable>
        {clearable && value && (
          <MotionPressable
            role="button"
            accessibilityLabel={`Clear ${label}`}
            disabled={disabled}
            onPress={() => {
              onChange(null);
              setOpen(false);
            }}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-accent"
          >
            <CustomIcon as={X} size={17} className="text-muted-foreground" />
          </MotionPressable>
        )}
      </View>

      {open && (
        <View className="gap-1 rounded-2xl border border-border bg-card p-3">
          <View className="flex-row items-center justify-between">
            <MotionPressable
              role="button"
              accessibilityLabel="Previous month"
              disabled={!canGoBack}
              onPress={() => shift(-1)}
              className="h-10 w-10 items-center justify-center rounded-full active:bg-accent"
              style={{ opacity: canGoBack ? 1 : 0.3 }}
            >
              <CustomIcon as={ChevronLeft} size={19} className="text-ink-700" />
            </MotionPressable>
            <CustomText accessibilityRole="header" className="font-sans-semibold text-[15px]">
              {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </CustomText>
            <MotionPressable
              role="button"
              accessibilityLabel="Next month"
              onPress={() => shift(1)}
              className="h-10 w-10 items-center justify-center rounded-full active:bg-accent"
            >
              <CustomIcon as={ChevronRight} size={19} className="text-ink-700" />
            </MotionPressable>
          </View>
          <View className="flex-row">
            {WEEK_HEADER.map((day, index) => (
              <CustomText
                key={index}
                className="flex-1 py-1 text-center font-sans-medium text-xs text-muted-foreground"
              >
                {day}
              </CustomText>
            ))}
          </View>
          {monthGrid(month).map((week, row) => (
            <View key={row} className="flex-row">
              {week.map((date, index) => {
                if (!date) return <View key={index} className="h-11 flex-1" />;
                const blocked = date < first;
                const picked = !!value && sameDay(date, value);
                // Fixed classes; picked, today and blocked go on as a style.
                return (
                  <MotionPressable
                    key={index}
                    role="button"
                    disabled={blocked}
                    accessibilityLabel={date.toLocaleDateString(undefined, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    accessibilityState={{ selected: picked, disabled: blocked }}
                    onPress={() => {
                      onChange(date);
                      setOpen(false);
                    }}
                    className="h-11 flex-1 items-center justify-center"
                  >
                    <View
                      className="h-9 w-9 items-center justify-center rounded-full border"
                      style={{
                        backgroundColor: picked ? colors.primary : "transparent",
                        borderColor:
                          !picked && sameDay(date, today) ? colors.primary : "transparent",
                        opacity: blocked ? 0.3 : 1,
                      }}
                    >
                      <CustomText
                        className="text-[15px]"
                        style={{ color: picked ? colors["primary-foreground"] : colors.foreground }}
                      >
                        {date.getDate()}
                      </CustomText>
                    </View>
                  </MotionPressable>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
