"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import { INTL_LOCALE, resolveLocale } from "@upm/config";

/**
 * Datas, horas, dinheiro e números da demonstração — sempre no idioma do site
 * =========================================================================
 * As fixtures de `@upm/ui/demo-data` não têm texto: o tempo são deslocamentos
 * (`minutesAgo`, `dayOffset`), o dinheiro são cêntimos e os números são
 * números. É aqui que isso se transforma no que se lê, com `Intl` e com o
 * idioma que o visitante escolheu — "há 12 min" / "12 min ago", "245 000 €" /
 * "€245,000".
 *
 * Duas consequências que valem a nota:
 *
 *  1. **a demonstração não envelhece.** Com "há 12 min" escrito à mão, uma
 *     visita "de quinta-feira" continuava a ser de quinta-feira seis meses
 *     depois. Contando a partir de `Date.now()`, o que se vê é sempre
 *     plausível.
 *  2. **não há risco de divergência entre servidor e cliente.** Os ecrãs da
 *     demonstração são carregados com `ssr: false` (ver `PlatformDemo`), por
 *     isso `Date.now()` corre uma vez, no browser, e não há HTML do servidor
 *     com que possa não bater.
 */
export function useDemoFormat() {
  const intlLocale = INTL_LOCALE[resolveLocale(useLocale())];

  return useMemo(() => {
    const euro = new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });
    const euroExact = new Intl.NumberFormat(intlLocale, { style: "currency", currency: "EUR" });
    const plain = new Intl.NumberFormat(intlLocale);
    const relative = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" });
    const weekday = new Intl.DateTimeFormat(intlLocale, { weekday: "short" });
    const dayMonth = new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short" });
    const medium = new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" });
    const dayNumber = new Intl.DateTimeFormat(intlLocale, { day: "numeric" });
    const monthShort = new Intl.DateTimeFormat(intlLocale, { month: "short" });
    const clock = new Intl.DateTimeFormat(intlLocale, { hour: "2-digit", minute: "2-digit" });

    /** O instante em que algo aconteceu, a partir do deslocamento da fixture. */
    function since(minutesAgo: number) {
      return new Date(Date.now() - minutesAgo * 60_000);
    }

    /** Hoje mais (ou menos) `offset` dias, à hora pedida. */
    function at(dayOffset: number, minuteOfDay = 0) {
      const date = new Date();
      date.setDate(date.getDate() + dayOffset);
      date.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
      return date;
    }

    return {
      intlLocale,
      /** Preços de anúncio: em euros, arredondados, sem cêntimos. */
      euro: (cents: number) => euro.format(cents / 100),
      /** Faturas: ao cêntimo, que é como uma fatura se lê. */
      euroExact: (cents: number) => euroExact.format(cents / 100),
      number: (value: number) => plain.format(value),
      /**
       * "há 12 min", "há 2 h", "ontem" — a unidade maior em que o valor ainda
       * é um número pequeno, que é como as pessoas dizem as horas.
       */
      ago: (minutes: number) => {
        if (minutes < 60) return relative.format(-minutes, "minute");
        if (minutes < 1440) return relative.format(-Math.round(minutes / 60), "hour");
        if (minutes < 10_080) return relative.format(-Math.round(minutes / 1440), "day");
        return relative.format(-Math.round(minutes / 10_080), "week");
      },
      agoDays: (days: number) => relative.format(-days, "day"),
      at,
      since,
      date: (date: Date) => medium.format(date),
      /** O quadradinho de dia/mês dos cartões de visita. */
      dayBox: (date: Date) => ({ day: dayNumber.format(date), month: monthShort.format(date) }),
      time: (date: Date) => clock.format(date),
      weekday: (date: Date) => weekday.format(date),
      dayMonth: (date: Date) => dayMonth.format(date),
      /** "4,1 MB" — tamanhos de ficheiro, como a Cloud os mostra. */
      bytes: (value: number) => {
        const units = ["B", "KB", "MB", "GB"];
        let size = value;
        let unit = 0;
        while (size >= 1024 && unit < units.length - 1) {
          size /= 1024;
          unit += 1;
        }
        const decimals = unit === 0 || size >= 100 ? 0 : 1;
        return `${new Intl.NumberFormat(intlLocale, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(size)} ${units[unit]}`;
      },
    };
  }, [intlLocale]);
}

export type DemoFormat = ReturnType<typeof useDemoFormat>;

/** O papel que a demonstração está a mostrar. */
export type DemoRole = "owner" | "buyer";
