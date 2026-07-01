/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.backend.git;

public record GitOperationResult(boolean success, String output) {
    public String firstLine() {
        if (output == null || output.isBlank()) {
            return success ? "Operacao concluida" : "Operacao falhou";
        }
        return output.lines().findFirst().orElse(output);
    }
}
