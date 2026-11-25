# job-finder

A web app that helps job seekers in Rwanda and beyond find real, current job openings in one place. Instead of checking many job boards, users search ince and can filter, sort and open listings directly.


**Live app (via load balancer):** http://35.176.40.4
**Demo video:** [Link:https://www.loom.com/share/310d4a67322540fdb18faf4feef12a46]


## Features

-**Search** jobs by title or keyword, country (Rwanda, Kenya, Uganda, US,Uk) and date posted
- **Filter** result by text (title or company), job type and remote-only
-**Sort**  by newest, oldest, title A-Z or company A-Z
-**Load more** results using the API's pagination cursor
-**Apply** links open the original job posting
-**Clear error message** for invalid input, no results,network problems, API rate limits,API downtime and timeouts
-**"Served by" indicator** shows which web server handled the request

## Tech stack

-**Frontend:** HTML, CSS, JavaScript
-**Backend:** Node.js with Express
-**Deployement:** Nginx (reverse proxy), systemd, HAProxy (load balancer)

## How it works

```
Browser -> lb-01 (HAProxy) -> web-01 / web-02 (Nginx) -> Node.js app ->JSearch API
````
The browser never talks to the Jsearch API directly. It calss the app's own endpoint (`/api/jobs`), and the server adds the secret API key and forwads the request. This keeps the key hidden from users.

## API used

**JSearch** by OpenWeb Ninja , on RapidAPI
- Documentation: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
- Endpoint: `Get https://jsearch.p.rapidapi.com/search-v2``
-Parameters used: `query`,`country`,`date_posted`,`num_pages`,`cursor``
-Authentication: `x-rapidapi-key`and `x-rapidapi-host`headers
- Rate limitsL the free Basic plan has a limited number of request per month, which is why the app caches results

## Running locally

Requirments: Node.js 18 or newer, and a RapidAPI key subscribed to JSearch (free Basic plan).

```bash
git clone https://github.com/rayanimanzi/job-finder.git
cd job-finder
npm install
````


Create a `.env`file in the project folder:

````
RAPIDAPI_KEY=your_rapidapi_key
JSEARCH_URL=https://jsearch.p.rapidapi.com/search-v2
````

Start the app:

```bash
npm start
````

Open http://localhost:3000.

## Deployment

## Servers
| Server | IP | Role |
|---|---|---|
| web-01 | 16.61.244.101 | Runs the app (Nginx + Node.js) |
| web-02 | 18.170.224.139 | Runs the app (Nginx + Node.js) |
| lb-01 | 35.176.40.4 | HAProxy load balancer |

### On each web server (web-01 and web-02)

1. Copy the `.env`file securely from my computer ( it is never pushed to GitHub):
```bash
scp -i ~/.ssh/school .env ubuntu@SERVER_IP:~/job-finder.env
```
2. Install Node.js 20 and git:
```bash
curl -fsSl https://deb.nodesource.com/setup_20.x | sudo -E bash - 
sudo apt-get install -y nodejs git
```
3. Download the app and install dependencies: 
```bash 
git clone https://github.com/rayanimanzi/job-finder.git
cd job-finder && npm install --omit=dev
mv `/job-finder.env .env && chmod 600 .env
```
4. Run the app as a systemd service so it restarts automatically after a crash or reboot (`/etc/systemd/system/job-finder.service`):
``ini
[Service]
User=ubuntu
WorkingDirector=/home/ubuntu/job-finder
ExecStart=/usr/bin/node server.js
Restart=always
```
```bash
sudo systemctl enable --now job-finder
```
5. Configure Nginx as a reverse proxy from port 80 to the app on port 3000(`/etc/nginx/site-available/default`):
```nginx
server {
    listen 8- default_server;
    add_header X-served-By $hostname always;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
```bash
sudo nginx -t && sudo service nginx restart
```

### Load balancer (lb-01)

HAProxy distributes traffic between the two web servers using the round-robin algorithm (`/etc/haproxy/haproxy.cfg`):

```
frontend http_front 
bind *:80
mode http
default_backend web_servers

backend web_servers
      mode http
      balance roundrobin
      server 7347-web-01 16.61.244.101:80 check
      server 7347-web-02 18.170.224.139:80 check
      ```

      ### Testing the load balancer

      ```bash
      for i in 1 2 3 4; do curl -s http://35.176.40.4/api/health; echo; done
      ```

      Result: request alternate between the two servers, so traffic is balanced:

      ```
      {"status":"ok","server":"7347-web-01"}
      {"status":"ok","server":"7347-web-02"}
      {"status":"ok","server":"7347-web-01"}
      {"status":"ok","server":"7347-web-02"}
      ```

      ## Security and perfomance

      -**API key protection:** the key is stored in `env`, listed in `.gitignore`, and only used on the server
      -**Input validation:** the server checks the search term (2-100 characters), country code and date filter before calling the API
      -**XSS protection:** job data is inserted with `textContent`, never as raw HTML
      -**Caching:** search results are cached in memory for 10 minutes, so repeated searches are instant and save API requests
      -**Timeouts:** API calls are cancelled after 20 seconds with a clear message

      ## Challenges and solutions 

      -**Wromg API endpoint:** the docs I first followed use `/search`, but the current API version uses `/search-v2`. I found the correct URL in RapidAPI's code snippet nd made it configurable in `.env`.
      -**API key rejected:** my key had an extra hidden character from copying, making it 51 characters instead of 50. I found it by checking the key lenght and removing it.
      -**Old server still running:** an old copy of the server kept using port 3000 with the broken key. I stopped it with `lsof -ti :3000 | xargs kill` and restarted.
      -**Wrong country results:** the API defaults to the US, so I added a country selector, with Rwanda as the default.
      -**Slow API responses (around 6 seconds):** solved with caching and a loading message.


      ## Credits

      -[JSearch API] (https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) by OpenWeb Ninja, for job data
      -[Express](https://expressjs.com/), the web server framework
      [dotenv](https://github.com/motdotla/dotenv), for loading en vironment variables
      [Nhinx](https://nginx.org/) and [HAProxy](https://www.haproxy.org/), for serving and load balancing


      ## Author

      Rayan Imanzi