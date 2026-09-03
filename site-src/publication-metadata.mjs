const primaryPublicationDate = "2026-09-03";

export const publicationDates = Object.freeze({
  site: primaryPublicationDate,
  evidencePaper: "2026-08-29",
  methodologyPaper: "2026-08-30",
  referenceArchitecture: "2026-08-29",
  terminologyContract: "2026-08-29"
});

export function publicationDateAsUtc(date) {
  return new Date(`${date}T00:00:00Z`);
}

export function formatPublicationDate(date, { uppercase = false, month = "long" } = {}) {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month,
    year: "numeric",
    timeZone: "UTC"
  }).format(publicationDateAsUtc(date));
  return uppercase ? formatted.toUpperCase() : formatted;
}
