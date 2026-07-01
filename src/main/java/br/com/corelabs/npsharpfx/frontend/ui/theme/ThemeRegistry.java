/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.frontend.ui.theme;

// Interface Collection usada para retornar listas de entradas de tema
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Registro central de temas disponíveis na aplicação.
 *
 * Responsabilidades dessa classe:
 *
 * 1) Carregar o package.json que descreve os temas disponíveis
 * 2) Manter um índice de temas registrados
 * 3) Carregar temas sob demanda
 * 4) Manter cache de temas já carregados
 *
 * Fluxo do sistema de temas:
 *
 * package.json
 *       ↓
 * ThemePackageLoader
 *       ↓
 * VSCodeThemePackage
 *       ↓
 * ThemeRegistry
 *       ↓
 * ThemeFileLoader
 *       ↓
 * EditorTheme
 *
 * Ou seja:
 * ThemeRegistry funciona como "catálogo de temas".
 */
public class ThemeRegistry {

    /**
     * Representa o package.json que descreve os temas disponíveis.
     */
    private final VSCodeThemePackage themePackage;

    /**
     * Mapa que armazena todas as entradas de temas registradas.
     *
     * chave → ID do tema
     * valor → VSCodeThemeEntry
     *
     * VSCodeThemeEntry contém:
     * - id
     * - label
     * - caminho do arquivo do tema
     */
    private final Map<String, VSCodeThemeEntry> entries = new LinkedHashMap<>();

    /**
     * Cache de temas já carregados.
     *
     * chave → ID do tema
     * valor → EditorTheme já carregado
     *
     * Isso evita reprocessar o JSON do tema toda vez.
     */
    private final Map<String, EditorTheme> cache = new LinkedHashMap<>();

    /**
     * Construtor do registro de temas.
     *
     * Processo:
     *
     * 1) Carrega package.json
     * 2) Itera sobre lista de temas declarados
     * 3) Registra cada tema no mapa entries
     */
    public ThemeRegistry() {

        // Carrega manifesto de temas
        this.themePackage = (VSCodeThemePackage) ThemePackageLoader.load();

        /**
         * Percorre todos os temas definidos no package.json
         * e registra no mapa interno.
         */
        for (VSCodeThemeEntry entry : themePackage.getContributes().getThemes()) {
            entries.put(entry.getId(), entry);
        }
    }

    /**
     * Retorna todas as entradas de temas disponíveis.
     *
     * Isso é usado por exemplo para:
     * - montar menu de seleção de tema
     * - listar temas disponíveis na UI
     */
    public Collection<VSCodeThemeEntry> getEntries() {
        return entries.values();
    }

    /**
     * Retorna um tema carregado pelo ID.
     *
     * Processo:
     *
     * 1) Se ID for nulo → usa primeiro tema registrado
     * 2) Se tema já estiver em cache → retorna direto
     * 3) Caso contrário → carrega tema do JSON
     * 4) Armazena no cache
     *
     * @param id ID do tema
     * @return EditorTheme pronto para uso
     */
    public EditorTheme getTheme(String id) {

        /**
         * Caso nenhum ID seja fornecido,
         * usa o primeiro tema registrado.
         */
        if (id == null || id.isBlank()) {

            id = entries.keySet().stream()
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException("Nenhum tema registrado"));
        }

        /**
         * Verifica se tema já foi carregado antes.
         */
        if (cache.containsKey(id)) {

            // Retorna versão já carregada
            return cache.get(id);
        }

        /**
         * Busca entrada correspondente ao ID.
         */
        VSCodeThemeEntry entry = entries.get(id);

        /**
         * Caso ID não exista no registro, lança erro.
         */
        if (entry == null) {
            throw new IllegalArgumentException("Tema não encontrado: " + id);
        }

        /**
         * Carrega tema do arquivo JSON.
         */
        EditorTheme theme = (EditorTheme) ThemeFileLoader.load(entry);

        /**
         * Guarda tema no cache para uso futuro.
         */
        cache.put(id, theme);

        /**
         * Retorna tema carregado.
         */
        return theme;
    }
}

