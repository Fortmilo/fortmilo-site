const primaryPublicationDate = "2026-08-29";

export const publicationDates = Object.freeze({
  site: primaryPublicationDate,
  evidencePaper: primaryPublicationDate,
  methodologyPaper: "2026-08-30",
  referenceArchitecture: primaryPublicationDate,
  terminologyContract: primaryPublicationDate
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
