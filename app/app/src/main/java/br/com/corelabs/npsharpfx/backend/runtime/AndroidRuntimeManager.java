package br.com.corelabs.npsharpfx.backend.runtime;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class AndroidRuntimeManager {

    public enum State {
        AVAILABLE,
        UNSUPPORTED
    }

    public static final class RuntimeStatus {
        private final LanguageRuntime language;
        private final State state;
        private final String version;
        private final String message;

        RuntimeStatus(LanguageRuntime language, State state, String version, String message) {
            this.language = language;
            this.state = state;
            this.version = version;
            this.message = message;
        }

        public LanguageRuntime language() {
            return language;
        }

        public State state() {
            return state;
        }

        public String version() {
            return version;
        }

        public String message() {
            return message;
        }
    }

    private static final String PREFS = "npsharp_android_runtimes";
    private final SharedPreferences prefs;
    private final Map<LanguageRuntime, RuntimeStatus> statuses = new EnumMap<>(LanguageRuntime.class);

    public AndroidRuntimeManager(Context context) {
        this.prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        refresh();
    }

    public void refresh() {
        statuses.clear();
        for (LanguageRuntime language : LanguageRuntime.values()) {
            if (language == LanguageRuntime.PORTUGOL) {
                statuses.put(language, new RuntimeStatus(
                        language,
                        State.AVAILABLE,
                        "npsharp-internal",
                        "Runtime interno executa Portugol diretamente no Android."
                ));
            } else {
                statuses.put(language, new RuntimeStatus(
                        language,
                        State.UNSUPPORTED,
                        "nao instalado",
                        "Android nao expoe toolchains desktop nativos. Use Portugol interno ou abra este workspace no desktop para "
                                + language.displayName() + "."
                ));
            }
        }
        prefs.edit().putLong("last_refresh", System.currentTimeMillis()).apply();
    }

    public List<RuntimeStatus> list() {
        return new ArrayList<>(statuses.values());
    }

    public RuntimeStatus status(LanguageRuntime language) {
        RuntimeStatus status = statuses.get(language);
        if (status != null) {
            return status;
        }
        return new RuntimeStatus(language, State.UNSUPPORTED, "desconhecido", "Runtime nao registrado.");
    }

    public boolean canRun(LanguageRuntime language) {
        return status(language).state() == State.AVAILABLE;
    }

    public List<String> installAllCommon() {
        refresh();
        List<String> log = new ArrayList<>();
        for (RuntimeStatus status : statuses.values()) {
            String marker = status.state() == State.AVAILABLE ? "[OK] " : "[LIMITADO] ";
            log.add(marker + status.language().displayName() + " - " + status.message());
        }
        return log;
    }

    public LanguageRuntime detectFromName(String fileName) {
        String name = fileName == null ? "" : fileName.toLowerCase(Locale.ROOT);
        if (name.endsWith(".gol") || name.endsWith(".por") || name.endsWith(".portugol") || name.endsWith(".alg")) {
            return LanguageRuntime.PORTUGOL;
        }
        if (name.endsWith(".java")) return LanguageRuntime.JAVA;
        if (name.endsWith(".kt")) return LanguageRuntime.KOTLIN;
        if (name.endsWith(".js")) return LanguageRuntime.NODE;
        if (name.endsWith(".py")) return LanguageRuntime.PYTHON;
        if (name.endsWith(".cs")) return LanguageRuntime.CSHARP;
        if (name.endsWith(".go")) return LanguageRuntime.GO;
        if (name.endsWith(".rs")) return LanguageRuntime.RUST;
        return LanguageRuntime.PORTUGOL;
    }
}
