/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.config;

import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import java.io.IOException;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

public final class SettingsService {
    private static final SettingsService INSTANCE = new SettingsService();

    private final PropertyChangeSupport changes = new PropertyChangeSupport(this);
    private final Path settingsPath;

    private AppSettings settings = new AppSettings();

    private SettingsService() {
        this.settingsPath = Path.of(System.getProperty("user.home"), ".npsharp", "settings.json");
        load();
    }

    public static SettingsService getInstance() {
        return INSTANCE;
    }

    public AppSettings getSettings() {
        return settings;
    }

    public Path getSettingsPath() {
        return settingsPath;
    }

    public void update(AppSettings newSettings) {
        AppSettings old = this.settings;
        this.settings = newSettings == null ? new AppSettings() : newSettings;
        save();
        changes.firePropertyChange("settings", old, this.settings);
    }

    public void reset() {
        update(new AppSettings());
    }

    public void addListener(PropertyChangeListener listener) {
        changes.addPropertyChangeListener(listener);
    }

    public void removeListener(PropertyChangeListener listener) {
        changes.removePropertyChangeListener(listener);
    }

    public void load() {
        try {
            Files.createDirectories(settingsPath.getParent());

            if (!Files.exists(settingsPath)) {
                settings = new AppSettings();
                save();
                return;
            }

            String json = Files.readString(settingsPath, StandardCharsets.UTF_8);

            if (json == null || json.isBlank()) {
                settings = new AppSettings();
                save();
                return;
            }

            settings = fromJson(json);
        } catch (Exception e) {
            System.err.println("[Settings] Failed to load settings: " + e.getMessage());
            settings = new AppSettings();
            save();
        }
    }

    public void save() {
        try {
            Files.createDirectories(settingsPath.getParent());
            Files.writeString(settingsPath, toJson(settings), StandardCharsets.UTF_8);
        } catch (IOException e) {
            System.err.println("[Settings] Failed to save settings: " + e.getMessage());
        }
    }

    private String toJson(AppSettings s) {
        StringBuilder out = new StringBuilder();
        out.append("{\n");

        Field[] fields = AppSettings.class.getFields();

        for (int i = 0; i < fields.length; i++) {
            Field field = fields[i];

            try {
                Object value = field.get(s);

                out.append("  \"")
                        .append(escape(field.getName()))
                        .append("\": ")
                        .append(toJsonValue(value));

                if (i < fields.length - 1) {
                    out.append(",");
                }

                out.append("\n");
            } catch (IllegalAccessException ignored) {
            }
        }

        out.append("}\n");
        return out.toString();
    }

    private AppSettings fromJson(String json) {
        AppSettings s = new AppSettings();

        for (Field field : AppSettings.class.getFields()) {
            String key = field.getName();

            try {
                if (field.getType() == String.class) {
                    field.set(s, readString(json, key, (String) field.get(s)));
                } else if (field.getType() == int.class) {
                    field.setInt(s, readInt(json, key, field.getInt(s)));
                } else if (field.getType() == double.class) {
                    field.setDouble(s, readDouble(json, key, field.getDouble(s)));
                } else if (field.getType() == boolean.class) {
                    field.setBoolean(s, readBoolean(json, key, field.getBoolean(s)));
                }
            } catch (Exception ignored) {
            }
        }

        return s;
    }

    private String toJsonValue(Object value) {
        if (value == null) {
            return "\"\"";
        }

        if (value instanceof Number || value instanceof Boolean) {
            return String.valueOf(value);
        }

        return "\"" + escape(String.valueOf(value)) + "\"";
    }

    private String readString(String json, String key, String fallback) {
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("\"" + java.util.regex.Pattern.quote(key) + "\"\\s*:\\s*\"((?:\\\\.|[^\"])*)\"")
                .matcher(json);

        return m.find() ? unescape(m.group(1)) : fallback;
    }

    private int readInt(String json, String key, int fallback) {
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("\"" + java.util.regex.Pattern.quote(key) + "\"\\s*:\\s*(-?\\d+)")
                .matcher(json);

        if (!m.find()) {
            return fallback;
        }

        try {
            return Integer.parseInt(m.group(1));
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private double readDouble(String json, String key, double fallback) {
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("\"" + java.util.regex.Pattern.quote(key) + "\"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)")
                .matcher(json);

        if (!m.find()) {
            return fallback;
        }

        try {
            return Double.parseDouble(m.group(1));
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private boolean readBoolean(String json, String key, boolean fallback) {
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("\"" + java.util.regex.Pattern.quote(key) + "\"\\s*:\\s*(true|false)")
                .matcher(json);

        return m.find() ? Boolean.parseBoolean(m.group(1)) : fallback;
    }

    private String escape(String value) {
        return value == null
                ? ""
                : value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }

    private String unescape(String value) {
        if (value == null) {
            return "";
        }

        return value
                .replace("\\n", "\n")
                .replace("\\r", "\r")
                .replace("\\\"", "\"")
                .replace("\\\\", "\\");
    }
}