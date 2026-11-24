const $ = (id) => document.getElementById(id);
let jobs =[];
let cursor = null;
let lastSearch = null;

async function fetchJobs(params) {
    let res;
    try {
        res = await fetch(`/api/jobs?${new URLSearchParams(params)}`);
    } catch (err) {
        throw new Error('Cannot reach the server. Check your connection.');
    }
    const data =await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    $('server-info').textContent ='Served by ' + data.server +(data.cached ? ' (cached)' : '');
    return data;
}

function showError(message) {
    $('error').textContent = message;
    $('error').classList.toggle('hidden', !message);
}

async function loadJobs(isNewSearch) {
    showError('');
    if (isNewSearch) {
        const q = $('query').value.trim();
        if (q.length < 2) return showError('Please type at least 2 characters.');
    lastSearch = { q, country: $('country').value, date_posted: $('date-posted').value };
jobs = [];
cursor = null;
        
        }
        $('search-btn').disabled = true;
        $('status').textContent = 'Loading jobs...';
        try {
            const params = cursor ? { ...lastSearch, cursor } : lastSearch;
            const data = await fetchJobs(params);
            const seen =new Set(jobs.map((job) => job.id));
            jobs = jobs.concat(data.jobs.filter((job) => !seen.has(job.id)));
            cursor = data.cursor;
            updateTypes();
            render();
        } catch (err) {
            showError(err.message);
            $('status').textContent = '';
            }
            $('search-btn').disabled = false;
}

function updateTypes() {
    const types = [...new Set(jobs.map((job) => job.type))];
    $('filter-type').innerHTML = '<option value="">All job types</option>';
    types.forEach((type) => $('filter-type').add(new Option(type,type)));
}

function getVisibleJobs() {
    const text = $('filter-text').value.toLowerCase();
    const type = $('filter-type').value;
    const time = (job) => new Date(job.postedAt || 0).getTime();
    const sorters = {
        newest: (a, b) => time(b) - time(a),
        oldest: (a, b) => time(a) - time(b),
        titles: (a, b) => a.title.localeCompare(b.title),
        company: (a, b) => a.employer.localeCompare(b.employer),
    };
    return jobs
        .filter((job) => !$('filter-remote').checked || job.isRemote)
        .filter((job) => !type || job.type === type)
        .filter((job) => (job.title + '' + job.employer).toLowerCase().includes(text))
        .sort(sorters[$('sort').value]);
    }

function el(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
}

function createCard(job){
    const card = el('article', 'card','');
    const place = [job.city, job.country].filter(Boolean).join(', ') || 'Location not listed';
    const posted = job.postedAt ? new Date(job.postedAt).toLocaleDateString() : 'Unknown date';
    card.append(
        el('h2', '', job.title),
        el('p', 'employer',job.employer),
        el('p', 'meta', place + ' | ' + job.type + (job.isRemote ? ' | Remote' : '') + ' | Posted ' + posted),
        el('p', 'snippet', job.snippet + '...')
        );
        if (job.applyLink) {
            const link = el('a', 'apply', 'Apply');
            link.href = job.applyLink;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            card.append(link);
        }
        return card;
}

function render() {
    const visible = getVisibleJobs();
    $('results').innerHTML = '';
    visible.forEach((job) => $('results').append(createCard(job)));
    $('controls').classList.toggle('hidden', jobs.length === 0);
    $('load-more').classList.toggle('hidden', !cursor);
    if (jobs.length === 0) $('status').textContent = 'No jobs found. Try another search.';
    else $('status').textContent = 'Showing ' + visible.length + ' of ' + jobs.length + ' jobs.';
}

$('search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    loadJobs(true);
});
$('load-more').addEventListener('click', () => loadJobs(false));
['filter-text', 'filter-type', 'filter-remote', 'sort'].forEach((id) => $(id).addEventListener('input', render));






