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

    EOF
}