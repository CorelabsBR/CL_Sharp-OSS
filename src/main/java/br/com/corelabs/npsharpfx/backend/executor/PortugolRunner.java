package br.com.corelabs.npsharpfx.backend.executor;

import java.util.function.Consumer;

import br.com.corelabs.npsharpfx.backend.portugol.runtime.PortugolInterpreter;

/**
 * Executor para código Portugol (.gol).
 * 
 * Implementa a interface LanguageRunner para executar
 * código em linguagem Portugol.
 */
public class PortugolRunner implements LanguageRunner {

    @Override
    public void execute(String source, Consumer<String> output) {
        try {
            PortugolInterpreter interpreter = new PortugolInterpreter();
            interpreter.executeWithOutput(source, output);
        } catch (Exception e) {
            output.accept("[ERRO] " + e.getMessage());
            e.printStackTrace();
        }
    }
}
