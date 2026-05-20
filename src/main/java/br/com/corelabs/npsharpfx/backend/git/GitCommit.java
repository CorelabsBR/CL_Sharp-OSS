package br.com.corelabs.npsharpfx.backend.git;

public record GitCommit(String hash, String author, String date, String subject, String body) {
}
