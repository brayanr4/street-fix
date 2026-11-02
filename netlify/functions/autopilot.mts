// Every hour, asks the app to send any check-ins and follow-ups that have come due.
const autopilot = async () => {
  const res = await fetch(`${process.env.URL}/api/cron`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  console.log("autopilot", res.status, await res.text());
};

export default autopilot;

export const config = { schedule: "@hourly" };
