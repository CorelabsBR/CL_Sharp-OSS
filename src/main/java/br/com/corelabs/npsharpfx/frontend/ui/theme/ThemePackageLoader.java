/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.ui.theme;

// Classe usada para ler arquivos do classpath como stream.
// Aqui é usada para abrir o package.json que lista os temas disponíveis.
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Objects;

import com.google.gson.Gson;

/**
 * Classe responsável por carregar o "package.json" que descreve
 * os temas disponíveis no editor.
 *
 * Esse arquivo normalmente contém algo assim:
 *
 * {
 *   "themes": [
 *     { "id": "np-dark", "label": "NP Dark", "path": "np-dark.json" },
 *     { "id": "vscode-dark", "label": "VSCode Dark", "path": "vscode-dark.json" }
 *   ]
 * }
 *
 * Fluxo:
 *
 * package.json
 *      ↓
 * ThemePackageLoader
 *      ↓
 * Gson
 *      ↓
 * VSCodeThemePackage
 *
 * Ou seja, ele lê o JSON e transforma em um objeto Java
 * que o sistema de temas consegue usar.
 *
 * Classe utilitária (somente métodos estáticos).
 */
public final class ThemePackageLoader {

    /**
     * Instância global do Gson usada para converter JSON → objetos Java.
     */
    private static final Gson GSON = new Gson();

    /**
     * Construtor privado.
     *
     * Impede criação de instâncias dessa classe.
     * Ela funciona apenas como utilitário estático.
     */
    private ThemePackageLoader() {
    }

    /**
     * Carrega o arquivo /themes/package.json do classpath.
     *
     * Esse arquivo descreve todos os temas disponíveis
     * dentro da aplicação.
     *
     * @return objeto VSCodeThemePackage contendo lista de temas
     */
    public static VSCodeThemePackage load() {

        /**
         * Abre o arquivo package.json que está dentro
         * da pasta /themes do classpath.
         */
        InputStream input = ThemePackageLoader.class.getResourceAsStream("/themes/package.json");

        if (input == null) {
            ClassLoader cl = Thread.currentThread().getContextClassLoader();
            if (cl != null) {
                input = cl.getResourceAsStream("themes/package.json");
            }
        }

        if (input == null) {
            input = ClassLoader.getSystemResourceAsStream("themes/package.json");
        }

        /**
         * Caso o arquivo não exista no classpath,
         * lança erro crítico.
         */
        if (input == null) {
            throw new IllegalStateException("Arquivo /themes/package.json não encontrado");
        }

        /**
         * Converte o InputStream em um leitor UTF-8.
         *
         * try-with-resources garante que o stream será fechado.
         */
        try (InputStreamReader reader = new InputStreamReader(input, StandardCharsets.UTF_8)) {

            /**
             * Converte JSON em objeto Java.
             */
            VSCodeThemePackage pkg = GSON.fromJson(reader, VSCodeThemePackage.class);

            /**
             * Verifica se o objeto carregado é válido.
             *
             * Se for null, lança erro com mensagem clara.
             */
            return Objects.requireNonNull(pkg, "Package de temas inválido");

        } catch (Exception e) {

            /**
             * Qualquer erro de leitura ou parsing do JSON
             * é encapsulado aqui.
             */
            throw new IllegalStateException("Erro ao carregar package.json dos temas", e);
        }
    }
}

