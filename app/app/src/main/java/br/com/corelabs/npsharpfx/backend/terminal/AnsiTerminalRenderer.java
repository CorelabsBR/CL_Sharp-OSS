package br.com.corelabs.npsharpfx.backend.terminal;

import android.graphics.Color;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;

public final class AnsiTerminalRenderer {
    private static final int[] ANSI = new int[] {
            Color.rgb(0, 0, 0),
            Color.rgb(205, 49, 49),
            Color.rgb(13, 188, 121),
            Color.rgb(229, 229, 16),
            Color.rgb(36, 114, 200),
            Color.rgb(188, 63, 188),
            Color.rgb(17, 168, 205),
            Color.rgb(229, 229, 229),
            Color.rgb(102, 102, 102),
            Color.rgb(241, 76, 76),
            Color.rgb(35, 209, 139),
            Color.rgb(245, 245, 67),
            Color.rgb(59, 142, 234),
            Color.rgb(214, 112, 214),
            Color.rgb(41, 184, 219),
            Color.WHITE
    };

    private AnsiTerminalRenderer() {}

    public static SpannableStringBuilder appendAnsi(SpannableStringBuilder target, String text, int defaultColor) {
        if (target == null) {
            target = new SpannableStringBuilder();
        }
        int color = defaultColor;
        int i = 0;
        while (text != null && i < text.length()) {
            char ch = text.charAt(i);
            if (ch == '\u001B' && i + 1 < text.length() && text.charAt(i + 1) == '[') {
                int end = text.indexOf('m', i + 2);
                if (end > i) {
                    color = applyCode(text.substring(i + 2, end), defaultColor, color);
                    i = end + 1;
                    continue;
                }
            }
            int start = target.length();
            target.append(ch);
            target.setSpan(new ForegroundColorSpan(color), start, start + 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            i++;
        }
        return target;
    }

    private static int applyCode(String codeText, int defaultColor, int current) {
        String[] codes = codeText.split(";");
        int color = current;
        for (String raw : codes) {
            int code;
            try {
                code = raw.isBlank() ? 0 : Integer.parseInt(raw);
            } catch (Exception e) {
                continue;
            }
            if (code == 0 || code == 39) {
                color = defaultColor;
            } else if (code >= 30 && code <= 37) {
                color = ANSI[code - 30];
            } else if (code >= 90 && code <= 97) {
                color = ANSI[8 + code - 90];
            }
        }
        return color;
    }
}
