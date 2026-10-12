import { describe, expect, it } from "vitest";
import { numberCandidates } from "./number-candidates";

describe("numberCandidates", () => {
    it("reads digits and keeps each value once", () => {
        expect(numberCandidates("Adiar 30 minutos")).toEqual([{ value: 30, text: "30" }]);
        expect(numberCandidates("de 4 em 4 horas").map((candidate) => candidate.value)).toEqual([4]);
    });

    it("reads Portuguese number words up to thirty", () => {
        expect(numberCandidates("Adiar duas horas").map((candidate) => candidate.value)).toEqual([2]);
        expect(numberCandidates("vinte e cinco minutos").map((candidate) => candidate.value)).toEqual([25]);
        expect(numberCandidates("meia dúzia")).toEqual([{ value: 6, text: "meia" }]);
    });

    it("reads half an hour and repeated intervals", () => {
        expect(numberCandidates("meia hora")).toEqual([{ value: 30, text: "meia hora" }]);
        expect(numberCandidates("hora em hora")).toEqual([{ value: 1, text: "hora em hora" }]);
        expect(numberCandidates("quatro em quatro")).toEqual([{ value: 4, text: "quatro em quatro" }]);
    });

    it("keeps distinct amounts from one message", () => {
        expect(numberCandidates("5x a cada 15 minutos").map((candidate) => candidate.value)).toEqual([5, 15]);
    });
});