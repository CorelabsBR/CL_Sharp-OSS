package br.com.corelabs.npsharpfx;

// Classe File usada para manipular arquivos do sistema.
// Aqui seria usada para criar um "lock file" e impedir duas instâncias do programa.
import java.nio.file.Path;

import br.com.corelabs.npsharpfx.backend.runtime.LanguageRuntime;
import br.com.corelabs.npsharpfx.backend.runtime.RuntimeInstaller;
import br.com.corelabs.npsharpfx.backend.runtime.RuntimePaths;
import br.com.corelabs.npsharpfx.backend.runtime.RuntimeRegistry;
import br.com.corelabs.npsharpfx.frontend.ui.window.MainWindow;
import javafx.application.Application;
import javafx.stage.Stage;


/*
 * Classe principal da aplicação.
 * 
 * Toda aplicação JavaFX precisa herdar de Application.
 * 
 * O JavaFX chama automaticamente o método start()
 * quando a interface gráfica começa.
 */
public class Main extends Application {


    /*
     * Método chamado automaticamente pelo JavaFX quando a aplicação inicia.
     * 
     * O Stage representa a janela principal do programa.
     */
@Override
public void start(Stage stage) {
    initializeExtensionsAsync();

    MainWindow window = new MainWindow(stage);
    window.show();
}

private void initializeExtensionsAsync() {
    Thread extensionThread = new Thread(() -> {
        System.out.println("");
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println(" ATIVANDO EXTENSÕES...");
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("");

        Path appData = RuntimePaths.appDataDir();

        try {
            RuntimeRegistry registry = new RuntimeRegistry(appData);
            registry.load();

            RuntimeInstaller installer = new RuntimeInstaller(appData, registry);

            installer.installAllCommon(new RuntimeInstaller.Listener() {
                @Override
                public void onLog(String message) {
                    System.out.println("[EXTENSION HOST] " + message);
                }

                @Override
                public void onProgress(LanguageRuntime language, double progress) {
                    int percent = (int) (progress * 100);

                    System.out.println(
                            "[EXTENSION HOST] "
                                    + language.displayName()
                                    + " -> "
                                    + percent
                                    + "%"
                    );
                }
            });

            System.out.println("");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            System.out.println(" EXTENSÕES ATIVADAS");
            System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            System.out.println("");

        } catch (Exception e) {
            System.err.println("[EXTENSION HOST] Falha ao ativar extensões.");
            e.printStackTrace();
        }
    }, "npsharp-extension-host");

    extensionThread.setDaemon(true);
    extensionThread.start();
}




    /*
     * Método main tradicional do Java.
     * 
     * Esse método é o ponto de entrada da aplicação
     * quando o programa é executado.
     */
    public static void main(String[] args) {

        /*
         * Aqui é apenas um banner ASCII
         * exibido no console quando o programa inicia.
         * 
         * Serve como identificação da aplicação.
         */
        System.out.println("  ░██████                                 ░██            ░██                   ░████████   ░█████████  ");
        System.out.println(" ░██   ░██                                ░██            ░██                   ░██    ░██  ░██     ░██ ");
        System.out.println("░██         ░███████  ░██░████  ░███████  ░██  ░██████   ░████████   ░███████  ░██    ░██  ░██     ░██ ");
        System.out.println("░██        ░██    ░██ ░███     ░██    ░██ ░██       ░██  ░██    ░██ ░██        ░████████   ░█████████  ");
        System.out.println("░██        ░██    ░██ ░██      ░█████████ ░██  ░███████  ░██    ░██  ░███████  ░██     ░██ ░██   ░██   ");
        System.out.println(" ░██   ░██ ░██    ░██ ░██      ░██        ░██ ░██   ░██  ░███   ░██        ░██ ░██     ░██ ░██    ░██  ");
        System.out.println("  ░██████   ░███████  ░██       ░███████  ░██  ░█████░██ ░██░█████   ░███████  ░█████████  ░██     ░██ ");
        System.out.println("-------------------------------------------------------------------------------------------------------");

        /*
         * Descrição da aplicação
         */
        System.out.println("CoreLabs NPSHARP - A modern, fast and efficient IDE for Development of projects.");

        /*
         * Mensagem de inicialização
         */
        System.out.println("Starting application...");


        /*
         * Cria um arquivo chamado app.lock
         * 
         * A ideia aqui seria impedir duas instâncias da aplicação rodando.
         */


        /*
         * Esse código foi comentado.
         * 
         * Ele serviria para impedir múltiplas instâncias do programa.
         * 
         * Funcionaria assim:
         * 
         * - tenta criar o arquivo app.lock
         * - se ele já existir, significa que o programa já está rodando
         * - então a aplicação encerra
         */

        // try {
        //
        //     // tenta criar o arquivo
        //     if (!lockFile.createNewFile()) {
        //
        //         // se não conseguiu criar, já existe uma instância rodando
        //         System.out.println("Another instance of the application is already running.");
        //
        //         // encerra o programa
        //         System.exit(0);
        //     }
        //
        //     // remove o arquivo automaticamente quando o programa fechar
        //     lockFile.deleteOnExit();
        //
        // } catch (IOException e) {
        //     e.printStackTrace();
        // }


        /*
         * Inicia o JavaFX.
         * 
         * Esse método chama internamente o start()
         * e inicia toda a interface gráfica.
         */
        launch(args);
    }
}
