package br.com.corelabs.npsharpfx.backend.portugol.runtime;

import java.util.List;

import br.com.corelabs.npsharpfx.backend.portugol.lexer.Lexer;
import br.com.corelabs.npsharpfx.backend.portugol.lexer.Token;

public class PortugolInterpreter {

    public void execute(String source) {

        Lexer lexer =
                new Lexer(source);

        List<Token> tokens =
                lexer.scanTokens();

        tokens.forEach(System.out::println);
    }
}