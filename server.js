require('dotenv').config();
const express = require('express');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.RAPIDAPI_KEY;
const API_URL = process.env.JSEARCH_URL || 'https://jsearch.p.rapidapi.com/search-v2';
const API_HOST = new URL(API_URL).host;

if (!API_KEY) {
  console.error('Missing RAPIDAPI_KEY in .env - the app cannot fetch jobs.');
  process.exit(1);
}

const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;
const DATE_OPTIONS = ['all', 'today', '3days', 'week', 'month'];

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: os.hostname() });
});

function simplifyJob(job) {
  return {
    id: job.job_id,
    title: job.job_title || 'Untitled role',
    employer: job.employer_name || 'Unknown employer',
    logo: job.employer_logo || null,
    city: job.job_city || '',
    country: job.job_country || '',
    isRemote: Boolean(job.job_is_remote),
    type: job.job_employment_type || 'Not specified',
    postedAt: job.job_posted_at_datetime_utc || null,
    applyLink: job.job_apply_link || null,
    publisher: job.job_publisher || '',
    minSalary: job.job_min_salary || null,
    maxSalary: job.job_max_salary || null,
    salaryPeriod: job.job_salary_period || null,
    snippet: (job.job_description || '').slice(0, 280),
  };
}

app.get('/api/jobs', async (req, res) => {
  const query = String(req.query.q || '').trim();
  const country = String(req.query.country || 'rw').trim().toLowerCase();
  const datePosted = String(req.query.date_posted || 'all');
  const cursor = String(req.query.cursor || '');

  if (query.length < 2 || query.length > 100) {
    return res.status(400).json({ error: 'Please enter a search term between 2 and 100 characters.' });
  }
  if (!/^[a-z]{2}$/.test(country)) {
    return res.status(400).json({ error: 'Country must be a 2-letter code, e.g. rw, ke, us.' });
  }
  if (!DATE_OPTIONS.includes(datePosted)) {
    return res.status(400).json({ error: 'Invalid date filter.' });
  }

  const cacheKey = JSON.stringify({ query, country, datePosted, cursor });
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    return res.json({ ...cached.data, cached: true, server: os.hostname() });
  }

  const url = new URL(API_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('country', country);
  url.searchParams.set('date_posted', datePosted);
  url.searchParams.set('num_pages', '1');
  if (cursor) url.searchParams.set('cursor', cursor);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      headers: { 'x-rapidapi-key': API_KEY, 'x-rapidapi-host': API_HOST },
      signal: controller.signal,
    });

    if (response.status === 429) {
      return res.status(503).json({ error: 'Too many searches right now (API limit reached). Please try again later.' });
    }
    if (response.status === 401 || response.status === 403) {
      console.error('JSearch rejected the API key:', response.status);
      return res.status(500).json({ error: 'The server could not authenticate with the jobs service.' });
    }
    if (!response.ok) {
      console.error('JSearch error:', response.status);
      return res.status(502).json({ error: 'The jobs service is having problems. Please try again in a moment.' });
    }

    const body = await response.json();
    const rawJobs = (body.data && body.data.jobs) || [];
    const data = {
      jobs: rawJobs.map(simplifyJob),
      cursor: (body.data && body.data.cursor) || null,
    };

    cache.set(cacheKey, { time: Date.now(), data });
    return res.json({ ...data, cached: false, server: os.hostname() });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'The jobs service took too long to respond. Please try again.' });
    }
    console.error('Request failed:', err.message);
    return res.status(502).json({ error: 'Could not reach the jobs service. Check your connection and try again.' });
  } finally {
    clearTimeout(timer);
  }
});

app.listen(PORT, () => {
  console.log(`Job Finder running on http://localhost:${PORT}`);
});
