package br.com.corelabs.npsharpfx.backend.executor;

import java.io.File;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Gerenciador centralizado de executores de linguagens.
 * 
 * Mapeia extensões de arquivo para seus executores correspondentes.
 * Permite adicionar novos executores para novas linguagens dinamicamente.
 * 
 * Exemplo:
 * 
 * ExecutorManager manager = ExecutorManager.getInstance();
 * manager.execute("arquivo.gol", code, output);
 */
public class ExecutorManager {

    private static final ExecutorManager INSTANCE = new ExecutorManager();
    
    private final Map<String, LanguageRunner> runners = new HashMap<>();

    private ExecutorManager() {
        registerDefaultRunners();
    }

    public static ExecutorManager getInstance() {
        return INSTANCE;
    }

    /**
     * Registra os executores padrão das linguagens suportadas.
     */
    private void registerDefaultRunners() {
        // Portugol
        runners.put("gol", new PortugolRunner());
        
        // Mais linguagens podem ser adicionadas aqui
        // runners.put("py", new PythonRunner());
        // runners.put("js", new JavaScriptRunner());
    }

    /**
     * Registra um novo executor para uma extensão.
     * 
     * @param extension extensão do arquivo (sem o ponto)
     * @param runner executor da linguagem
     */
    public void registerRunner(String extension, LanguageRunner runner) {
        runners.put(extension.toLowerCase(Locale.ROOT), runner);
        System.out.println("[ExecutorManager] Registered runner for: " + extension);
    }

    /**
     * Executa código baseado no arquivo.
     * 
     * @param file arquivo com código
     * @param output handler para saída
     * 
     * @throws IllegalArgumentException se não houver executor para a extensão
     */
    public void execute(File file, String source, Consumer<String> output) {
        String extension = getFileExtension(file);
        
        LanguageRunner runner = runners.get(extension);
        
        if (runner == null) {
            throw new IllegalArgumentException(
                "Nenhum executor disponível para: ." + extension
            );
        }

        runner.execute(source, output);
    }

    /**
     * Executa código baseado no nome do arquivo como string.
     * 
     * @param filename nome do arquivo (ex: "programa.gol")
     * @param output handler para saída
     * 
     * @throws IllegalArgumentException se não houver executor para a extensão
     */
    public void execute(String filename, String source, Consumer<String> output) {
        File file = new File(filename);
        execute(file, source, output);
    }

    /**
     * Extrai a extensão do arquivo.
     * 
     * @param file arquivo
     * @return extensão em minúsculas (sem o ponto)
     */
    private String getFileExtension(File file) {
        String name = file.getName().toLowerCase(Locale.ROOT);
        int dotIndex = name.lastIndexOf('.');
        
        if (dotIndex == -1 || dotIndex == name.length() - 1) {
            throw new IllegalArgumentException("Arquivo sem extensão: " + file.getName());
        }

        return name.substring(dotIndex + 1);
    }

    /**
     * Verifica se há um executor para a extensão.
     * 
     * @param extension extensão (sem o ponto)
     * @return true se há executor registrado
     */
    public boolean hasRunner(String extension) {
        return runners.containsKey(extension.toLowerCase(Locale.ROOT));
    }

    /**
     * Lista todas as extensões suportadas.
     * 
     * @return array com extensões suportadas
     */
    public String[] getSupportedExtensions() {
        return runners.keySet().toArray(new String[0]);
    }
}
