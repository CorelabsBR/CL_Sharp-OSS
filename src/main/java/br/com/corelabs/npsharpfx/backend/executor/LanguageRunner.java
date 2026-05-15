package br.com.corelabs.npsharpfx.backend.executor;

import java.util.function.Consumer;

/**
 * Interface para executores de linguagens diferentes.
 * Cada linguagem (Portugol, Python, etc.) implementa um executor.
 */
public interface LanguageRunner {
    
    /**
     * Executa o código e envia a saída para o handler.
     * 
     * @param source código-fonte
     * @param output handler para saída do programa
     */
    void execute(String source, Consumer<String> output);
}
