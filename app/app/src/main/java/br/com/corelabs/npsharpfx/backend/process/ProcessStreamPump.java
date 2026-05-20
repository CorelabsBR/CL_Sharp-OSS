package br.com.corelabs.npsharpfx.backend.process;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.function.Consumer;

public final class ProcessStreamPump implements Runnable {
    private final InputStream input;
    private final StringBuilder sink;
    private final Consumer<String> listener;

    public ProcessStreamPump(InputStream input, StringBuilder sink, Consumer<String> listener) {
        this.input = input;
        this.sink = sink;
        this.listener = listener;
    }

    @Override
    public void run() {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String value = line + "\n";
                synchronized (sink) {
                    sink.append(value);
                }
                if (listener != null) {
                    listener.accept(value);
                }
            }
        } catch (Exception e) {
            String value = "[process-stream] " + (e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()) + "\n";
            synchronized (sink) {
                sink.append(value);
            }
            if (listener != null) {
                listener.accept(value);
            }
        }
    }
}
