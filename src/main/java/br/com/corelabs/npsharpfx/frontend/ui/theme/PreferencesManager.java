package br.com.corelabs.npsharpfx.frontend.ui.theme;

// Exceções de I/O usadas para lidar com leitura/escrita de arquivos
import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

/**
 * Gerenciador de preferências do usuário.
 *
 * Responsável por:
 *
 * 1) Definir diretório de configuração da aplicação
 * 2) Carregar preferências do usuário
 * 3) Salvar preferências no disco
 * 4) Garantir que diretórios necessários existam
 *
 * Estrutura criada no sistema:
 *
 * ~/.npsharp/
 *     ├ config.json
 *     └ wallpapers/
 *
 * Onde:
 *
 * config.json → armazena preferências do usuário
 * wallpapers  → armazena wallpapers personalizados
 *
 * Esta classe usa Gson para converter entre:
 *
 * UserPreferences (objeto Java)
 * ↔
 * JSON salvo em disco
 *
 * Classe utilitária (somente métodos estáticos).
 */
public final class PreferencesManager {

    /**
     * Instância global do Gson configurada para
     * gerar JSON formatado (legível).
     *
     * setPrettyPrinting() faz o JSON ficar assim:
     *
     * {
     *   "theme": "dark",
     *   "fontSize": 14
     * }
     */
    private static final Gson GSON = new GsonBuilder()
            .setPrettyPrinting()
            .create();

    /**
     * Construtor privado.
     *
     * Impede criação de instâncias da classe.
     */
    private PreferencesManager() {
    }

    /**
     * Retorna o diretório principal da aplicação.
     *
     * Caminho final:
     *
     * ~/.npsharp
     *
     * System.getProperty("user.home")
     * retorna o diretório HOME do usuário.
     *
     * Exemplos:
     *
     * Linux:
     * /home/girelli/.npsharp
     *
     * Windows:
     * C:\Users\Girelli\.npsharp
     */
    public static Path getAppDir() {
        return Path.of(System.getProperty("user.home"), ".npsharp");
    }

    /**
     * Retorna o diretório onde ficam wallpapers
     * personalizados da aplicação.
     *
     * ~/.npsharp/wallpapers
     */
    public static Path getWallpaperDir() {
        return getAppDir().resolve("wallpapers");
    }

    /**
     * Retorna o caminho do arquivo de configuração.
     *
     * ~/.npsharp/config.json
     */
    public static Path getConfigFile() {
        return getAppDir().resolve("config.json");
    }

    /**
     * Carrega as preferências do usuário.
     *
     * Processo:
     *
     * 1) Garante que diretórios existam
     * 2) Verifica se config.json existe
     * 3) Se não existir → cria config padrão
     * 4) Se existir → carrega JSON
     * 5) Converte JSON → UserPreferences
     */
    public static UserPreferences load() {

        try {

            /**
             * Garante que diretório da aplicação exista.
             */
            Files.createDirectories(getAppDir());

            /**
             * Garante que diretório de wallpapers exista.
             */
            Files.createDirectories(getWallpaperDir());

            /**
             * Caminho do arquivo de configuração.
             */
            Path file = getConfigFile();

            /**
             * Caso o arquivo não exista,
             * cria configuração padrão.
             */
            if (!Files.exists(file)) {

                // cria preferências padrão
                UserPreferences preferences = new UserPreferences();

                // salva no disco
                save(preferences);

                return preferences;
            }

            /**
             * Caso o arquivo exista,
             * abre para leitura.
             */
            try (Reader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {

                /**
                 * Converte JSON → objeto Java.
                 */
                UserPreferences preferences = GSON.fromJson(reader, UserPreferences.class);

                /**
                 * Caso JSON esteja vazio ou inválido,
                 * retorna preferências padrão.
                 */
                return preferences != null ? preferences : new UserPreferences();
            }

        } catch (IOException e) {

            /**
             * Erro crítico ao acessar preferências.
             */
            throw new IllegalStateException("Erro ao carregar preferências", e);
        }
    }

    /**
     * Salva preferências do usuário no arquivo JSON.
     *
     * Processo:
     *
     * 1) Garante que diretórios existam
     * 2) Abre config.json
     * 3) Serializa objeto UserPreferences
     * 4) Escreve JSON no arquivo
     */
    public static void save(UserPreferences preferences) {

        try {

            /**
             * Garante existência do diretório principal.
             */
            Files.createDirectories(getAppDir());

            /**
             * Garante existência da pasta de wallpapers.
             */
            Files.createDirectories(getWallpaperDir());

            /**
             * Abre arquivo de configuração para escrita.
             */
            try (Writer writer = Files.newBufferedWriter(getConfigFile(), StandardCharsets.UTF_8)) {

                /**
                 * Converte objeto Java → JSON
                 * e escreve no arquivo.
                 */
                GSON.toJson(preferences, writer);
            }

        } catch (IOException e) {

            /**
             * Erro ao salvar preferências.
             */
            throw new IllegalStateException("Erro ao salvar preferências", e);
        }
    }
}

