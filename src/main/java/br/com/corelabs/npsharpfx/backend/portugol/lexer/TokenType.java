/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.backend.portugol.lexer;

public enum TokenType {

    /*
    ========================================
    KEYWORDS
    ========================================
    */

    ALGORITMO,
    VAR,
    INICIO,
    FIMALGORITMO,

    ESCREVA,
    ESCREVAL,

    INTEIRO,
    REAL,
    LOGICO,
    CARACTERE,
    LITERAL,
    LIMPATELA,
    LEIA,

    /*
    ========================================
    IDENTIFIERS
    ========================================
    */

    IDENTIFIER,

    /*
    ========================================
    LITERALS
    ========================================
    */

    STRING,
    NUMBER,
    BOOLEAN,

    /*
    ========================================
    OPERATORS
    ========================================
    */

    ASSIGN,

    PLUS,
    MINUS,
    STAR,
    SLASH,

    EQUAL,
    NOT_EQUAL,
    GREATER,
    GREATER_EQUAL,
    LESS,
    LESS_EQUAL,

    /*
    ========================================
    SYMBOLS
    ========================================
    */

    LEFT_PAREN,
    RIGHT_PAREN,

    COLON,
    COMMA,

    NEWLINE,
    SE,
ENTAO,
SENAO,
FIMSE,

ENQUANTO,
FACA,
FIMENQUANTO,

AND,
OR,
NOT,
LEFT_BRACKET,
RIGHT_BRACKET,
DOT_DOT,

VETOR,
DE,
EOF
}