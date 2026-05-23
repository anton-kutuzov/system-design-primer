# CS S75 — Lecture 9: Scalability
David Malan, Harvard

---

Say you have a website — static files, PHP, MySQL. It got popular, and now you need to think about how to scale it for real traffic. But first, you need somewhere to actually deploy it.

---

## 1. Choosing a Host

### Shared Hosting

The cheapest option — companies like DreamHost charge ~$9.95/month and promise unlimited bandwidth, storage, and RAM. Sounds great, but it's not real. The provider is betting that 90% of customers barely use the server. In practice you're sharing one physical machine with hundreds of others, all competing for the same CPU, RAM, and disk. Not a serious option for a real project.

One more thing to check when picking a host — whether its IP range gets blocked on the networks you care about. Some countries and corporate networks block entire provider ranges. YouTube and Facebook are common casualties.

And always use SFTP, not FTP. FTP sends everything in plaintext — username, password, everything. The actual files don't need encryption, they're meant to be public anyway, but credentials in plaintext are a problem. The S in SFTP stands for Secure, all traffic is encrypted.

### VPS — Virtual Private Server

The next tier is a rented virtual machine. The provider takes a powerful physical server and splits it using a hypervisor (VMware, Citrix, and others) into multiple virtual machines. Each customer gets their own copy of the OS — other users don't have accounts on your machine.

There's a catch though: the provider's own administrators can still access your virtual machine — for example by rebooting it into diagnostic mode, where the root password isn't required. If you need true privacy, the only real answer is owning your own physical servers. VPS costs $50/month and up, versus $10 for shared.

### Amazon EC2

The most flexible option — VPS on demand. You pay a few cents per minute per machine and spin up as many as you need. The key thing here is automatic scaling: you get posted on Reddit, traffic spikes 100x overnight — you automatically bring up new servers. Interest fades — they automatically shut down.

---

## 2. Vertical Scaling

The first instinct when your site starts struggling is to buy a beefier server: more RAM, faster CPU, more disk. That's vertical scaling, or more plainly, throwing money at the problem.

It works, but it has a ceiling. CPUs run at ~3 GHz, servers top out at a few dozen cores — the world simply doesn't make machines with infinite resources. Eventually you'll hit a physical or financial limit.

### Multiple Cores

Modern servers have at least 2 CPUs, each with several cores. Most laptops today are at minimum dual-core, often quad-core.

Quad-core doesn't mean "sort of parallel" — it means literally four things happening at once. Single-core processors did everything sequentially: the OS gave each program a fraction of a second of CPU time and switched between them rapidly. We didn't notice because humans are slow compared to a processor. When it seemed like you were simultaneously typing a document, loading a map, and getting email — it was actually happening one at a time, just very fast.

For a web server that means: one core handles one request at a time, quad-core handles at least four in parallel. In practice even more, because servers also run multiple processes and threads.

Incidentally, the trend toward more and more cores is exactly what lets providers slice powerful servers into VPS instances — the more cores, the more virtual machines you can fit on one piece of hardware.

### Hard Drive Types

**Parallel ATA / IDE** — an old standard, still found in older machines.

**SATA** — the modern standard: 7200 RPM, drives up to 4 TB and beyond. Inside a mechanical drive metal platters spin like an old vinyl record — bits are stored on their surface. The faster they spin, the faster reads and writes.

**SAS (Serial Attached SCSI)** — the server standard: 15,000 RPM, twice as fast as SATA. More expensive, but this is what goes under databases — every Facebook update is a disk write, and speed matters here.

**SSD** — no moving parts, much faster than mechanical drives. More expensive and smaller: at the time of this lecture, the largest SSD was 768 GB at a price significantly higher than a 4 TB SATA drive.

---

## 3. Horizontal Scaling

Vertical scaling will hit a wall eventually — you have to accept that and design the system differently. Horizontal scaling means a lot of relatively cheap servers instead of one expensive one, possibly a few years old, nothing top-of-the-line.

The immediate question is: if you have multiple servers, how do you distribute incoming traffic across them?

---

## 4. Load Balancing

You put a load balancer between the internet and your backend servers — a device or piece of software that distributes incoming requests.

DNS returns the IP of the load balancer, not the backend servers. A request arrives at the balancer, it decides where to send it, forwards it, gets the response, and returns it to the client. The backend servers have private IP addresses — `192.168.x.x`, `10.x.x.x`, `172.16.x.x`. Nobody outside can reach them directly, which is a security bonus. You also don't need to burn a public IPv4 address on every server — they've been scarce for a while.

### What should the backend servers contain?

There are two approaches. One is identical servers — all have the same content, so it doesn't matter which one handles the request. The downside is N times the disk usage. The other is dedicated servers by content type: one for images (`images.example.com`), another for video (`videos.example.com`). The balancer looks at the HTTP `Host` header and routes accordingly.

### How does the balancer decide where to send a request?

One way is by load: ask each server "how busy are you?" and send to the least loaded one. Smart, but it requires a monitoring mechanism.

A simpler option is round-robin through DNS — DNS just returns different IPs in rotation. Example BIND (Berkeley Internet Name Daemon) config:

```
dubdub  IN A  1.2.3.1
dubdub  IN A  1.2.3.2
dubdub  IN A  1.2.3.3
```

Google uses DNS round-robin too. But this approach has problems.

First — uneven load. One user makes expensive requests, another makes cheap ones, and round-robin has no idea.

Second — DNS caching. Browsers and the OS cache DNS responses: there's no point making a new DNS request on every click. So subsequent requests from the same user all go to the same server they started on.

Third — TTL (Time To Live): DNS records live in cache anywhere from minutes to several days depending on settings. Until the TTL expires, a user is pinned to one server and all their traffic keeps going there even if that server is overloaded.

A dedicated load balancer is better: DNS always returns one IP — the balancer's. No caching problem, and the balancer can factor in actual load.

---

## 5. Sessions Break

With a load balancer things look good, but then the next problem shows up.

PHP stores session data in the filesystem — in `/tmp` as serialized files. Each server only stores its own sessions.

Alice logs in, lands on server 1, her session is created there. Her next request goes to server 2 — it has no idea about her session and asks her to log in again.

In e-commerce it's worse: Alice adds a book to her cart on server 1, ends up on server 2 — different cart. At checkout, there's no way to combine the items.

### Partial fix with dedicated servers

If you put PHP on a dedicated server, all PHP traffic always goes to one machine and the session problem disappears. But this has two flaws: no redundancy — if the PHP server goes down, all dynamic functionality is gone. And as soon as it can't handle the load, you're right back to the same session problem anyway.

---

## 6. Shared Session Storage

The right answer is to move sessions to a separate server that all web servers can access. Options:

- NFS (Network File System) — one server shares its disk with several other machines
- MySQL — since it's already a separate server, you can store session data there too
- The load balancer itself — it's already the middleman for all traffic, it has a disk. Though then it's no longer "just" a load balancer

But this solution immediately creates a new problem.

You spent money on N web servers specifically to avoid a single point of failure. But as soon as you introduce one session server — if it goes down, the whole point of those N servers is gone: the site stops, nobody can log in. It's like a leaky garden hose: plug one hole with your hand and a new one pops up somewhere else.

---

## 7. RAID

One way to reduce the risk of the file server dying is to make the disks more reliable. That's what RAID is — Redundant Array of Independent Disks.

**RAID 0 (Striping).** Two disks, a file is written in chunks alternating between them. Write speed doubles because both disks work in parallel. But if one disk dies, you lose everything — no redundancy at all.

**RAID 1 (Mirroring).** Two disks, every file is written to both simultaneously. If one disk dies, the other keeps running with the data intact. Recovery is straightforward: buy a new disk, plug it in, the array automatically copies data from the surviving disk to the new one — takes a few minutes to hours. On many servers this happens while the machine is still running, no downtime required — hot-swap. The only cost is 50% of your disk capacity goes to duplication. And there's really no reason not to run RAID 1 even on a home desktop.

**RAID 10 (1+0).** Four disks: combines striping and mirroring, so you get both speed and redundancy. Twice as many disks, twice the cost.

**RAID 5.** Minimum three disks, only one of N used for redundancy. Five 1 TB drives give you 4 TB usable. You lose 20%, not 50% like RAID 1. Any single disk can die and data will be recovered.

**RAID 6.** Same as RAID 5 but with double redundancy — any two disks can die simultaneously and you won't lose data.

Real datacenter servers typically have multiple power supplies with the same hot-swap logic: one dies, the machine keeps running, you swap in a new one while it's still on.

RAID handles disk failure, but a server can go down for other reasons too — power cut, RAM failure, motherboard. The only real answer is having two such servers with data synced between them. We'll get to that in the replication section.

---

## 8. Shared Storage Technologies

Since you need shared session storage, here's what actually exists:

**Fiber Channel (FC)** — very fast, very expensive, meant for enterprise datacenters.

**iSCSI** — uses regular Ethernet cables and IP, cheaper than FC. But it's typically used with a single server, so it doesn't actually solve the shared sessions problem.

**NFS** — one server shares its disk with multiple machines over the network.

**MySQL** — store sessions directly in the database.

---

## 9. Load Balancer Options

On the software side — Amazon Elastic Load Balancer, HAProxy (High Availability Proxy, open source, very popular), Linux Virtual Server. All free.

On the hardware side — Barracuda, Cisco, Citrix, F5. A small load balancer at Harvard cost $220,000 — and that's considered cheap. A pair of enterprise load balancers runs $100,000+, much of that being support contracts. The software options do the same thing for free.

---

## 10. Session Affinity via Cookies

There's another approach to the session problem that doesn't require any shared storage at all.

The first idea that comes to mind: store the entire session contents in a cookie. Then the session travels with the user and isn't tied to any server. But this is a bad idea for two reasons. First, privacy: instead of one random key you'd be storing, say, the ISBNs of all the books in the shopping cart — roommates and family members don't need to see what's in your cookies. Second, size: cookies are limited to a few kilobytes, and there will definitely be cases where you can't fit everything you need.

The right version is to store just a server identifier in the cookie. The user comes back and essentially shows a hand stamp: "I was on server 1, send me there again." The balancer reads the cookie and routes accordingly.

An obvious objection: what if the cookie expires? But that's not a new problem specific to load balancing — cookies expire even with a single server. You can set a 10-year expiration if you want. So expiration isn't an argument against this.

Why not just store the server's IP address in the cookie directly? The IP might change, and there's no reason to expose your internal network layout. Better to store a large random number — like how PHP stores session IDs — and have the balancer maintain a table: number A → server 1, number B → server 2. This also removes the ability to spoof a cookie and land on someone else's server.

The balancer inserts the cookie automatically via the `Set-Cookie` header — nothing needs to change on the backend servers. The only downside: if the user has cookies disabled, the whole thing breaks. But then most other functionality doesn't work either.

---

## 11. PHP Acceleration

PHP is an interpreted language, like Python or Ruby. On every request it reads the source file, compiles it to opcodes (something like bytecode, the way Java does it), executes, and throws the result away. Next request — starts over.

PHP accelerators (APC, eAccelerator, Xcache, Zend Optimizer) save the compiled opcodes. The next request to the same file skips compilation and goes straight to execution. Free, easy to install, noticeable performance gain.

Python does the same thing with `.pyc` files saved alongside source files. If you change a `.php` file, the opcode cache needs to be cleared — accelerators handle that automatically.

---

## 12. Caching

Caching is useful, but it can also bite you. We already saw this with DNS: caching responses helped avoid extra lookups, but it also caused problems with round-robin balancing. Same principle everywhere: if the data changed but the cache has an old version, the user sees stale information. With any cache you have to think about when and how to invalidate it.

### File-based caching — the Craigslist approach

Craigslist saves dynamically generated pages as static `.html` files on disk. Someone posts a listing — Craigslist generates the HTML once and saves the file. The next thousand visitors all get that prebuilt file.

Apache is incredibly well optimized for serving static content — just send bytes from a file. No PHP, no database, no generation. And it makes sense for Craigslist specifically because it's read-heavy: people browse listings far more often than they post. By some accounts they get by with remarkably little hardware as a result.

The downsides are obvious: duplicated HTML markup in every file, and any design change requires regenerating or editing tens of thousands of files. That's probably a big part of why Craigslist never changed its look for years.

### MySQL Query Cache

MySQL can cache query results. One line in `my.cnf` turns it on:

```
query_cache_type = 1
```

First time a `SELECT` runs it might be slow. Next time the same query with the same parameters runs — result comes from cache instantly. If the underlying data changed, the cache clears automatically.

### Memcache

One level further — Memcache: a separate server that stores arbitrary data directly in RAM as a key-value store. Facebook used it heavily in the early days.

The motivation: if you have millions of users, running `SELECT * FROM users` on every profile request is expensive. Better to run it once, store the result in RAM, and pull from there on repeat requests.

```php
$mc = new Memcache;
$mc->connect('localhost', 11211);

$user = $mc->get('user_' . $id);
if ($user === null) {
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $user = $stmt->fetch();
    $mc->set('user_' . $user['id'], $user);
}
```

If the user isn't in cache, `get` returns null, you go to the database, and save the result to Memcache. Next time you pull from RAM.

Speed hierarchy from slowest to fastest: disk → MySQL with indexes → Memcache.

When RAM fills up, Memcache uses LRU (Least Recently Used): it evicts whatever hasn't been accessed the longest. Every cache hit updates an object's timestamp, effectively moving it back to the front of the line.

Why Facebook used Memcache so heavily: loading a news feed means potentially 10–20 database queries (one per friend). But a user might update their status once per session. Reads always vastly outnumber writes — that's exactly when caching pays off.

---

## 13. MySQL Storage Engines

MySQL supports different storage engines — different formats for physically storing data, each with its own tradeoffs.

| Engine | What it does |
|---|---|
| InnoDB (default) | Transactions, row-level locking |
| MyISAM | No transactions, table-level locking — locks the whole table on writes |
| MEMORY | RAM only, data lost on restart. Useful for implementing a simple cache directly in MySQL |
| ARCHIVE | Automatically compresses data, slower to read. Good for logs: data gets written constantly but rarely read — only for diagnostics. Why keep it at full size if you almost never query it? |
| NDB | Network-based engine for clustering, one option for addressing the single point of failure problem in storage |

---

## 14. Database Replication

RAID handles disk failure but not server failure. The real answer to database reliability is replication.

The principle is simple: any query executed on the master server is automatically copied to one or more slave servers, which execute it locally. All servers end up with identical data.

### Master-Slave

One master, one or more slaves.

There are two uses. The first is redundancy: master dies, you promote a slave. A bit of reconfiguration to make the slave the new master and reassign the remaining slaves to it. The whole process can be scripted — detect the master going down, script handles the failover without any human in the loop.

The second is read scaling, especially relevant for Facebook: all `SELECT` queries go to slaves, all `INSERT/UPDATE/DELETE` go to master only. You can keep adding slaves as read traffic grows.

While the master is down and you're switching over, the site goes read-only — you can browse profiles but can't post updates. The master is still a single point of failure for writes.

### Master-Master

Two master servers that replicate to each other. You can write to either one; if one goes down the other keeps accepting all requests.

In PHP it's straightforward:

```php
$db = @mysql_connect('db1.example.com', ...) 
   or mysql_connect('db2.example.com', ...);
```

If the first master connection fails, try the second — no manual intervention needed.

---

## 15. Putting It All Together

Here's the full picture:

```
                        INTERNET
                           |
              [Firewall: TCP 80, 443, VPN]
                           |
                 [LB1] ←heartbeat→ [LB2]        ← HA pair
                 SSL Termination, Session Cookies
                    /              \
              [WWW 1]            [WWW 2]          ← Web servers
                     \            /
                   [LB MySQL]                     ← DB load balancer
                    /          \
          [DB Master 1] ↔ [DB Master 2]           ← Master-Master
                \                  /
           [Slave 1]          [Slave 2]            ← Read slaves
```

Why can't web servers connect directly to the databases? If each web server is only connected to "its own" DB — Alice updates her profile through WWW 1, the data goes to DB 1, and when she lands on WWW 2 she sees the old data from DB 2. If each web server connects to both databases you need if/else logic in the code, and adding a third database means changing the code everywhere. A load balancer in between handles it cleanly.

Load balancers are themselves a single point of failure. The fix is an HA pair: two balancers exchange heartbeat packets every second. If one stops receiving heartbeats, it assumes the other has gone down, takes over its IP, and handles all traffic. In active-active mode both accept traffic simultaneously. In active-passive one is active, the other waits and takes over when the first fails.

The network is vulnerable too. Each server connects to two switches — one network interface to switch 1, another to switch 2. You have to be careful not to create loops in the network, otherwise traffic starts bouncing around infinitely and nothing works. Switches need to run loop-prevention protocols.

High Availability, or HA, isn't just about load balancers. The term means any setup of two or more servers monitoring each other's heartbeats, so that if one fails the other takes the full load. It applies equally to load balancers and databases.

---

## 16. Partitioning

Even with replication, you might eventually reach a point where one master can't handle the data volume. The solution is to split data across multiple servers by some criteria — that's partitioning.

Facebook actually did this early on: `harvard.thefacebook.com`, `mit.thefacebook.com` — separate database and servers for each university. Simple and effective. The problem showed up when people wanted to interact with users from another school — the data was in separate databases. Some features only worked within your own network at first.

A more general version is alphabetical partitioning: last names A–M go to server 1, N–Z to server 2. The load balancer checks the last name at login and routes accordingly. Each partition can have its own group of slaves — horizontal scaling within each shard.

---

## 17. Data Center Redundancy

Even a perfectly configured datacenter can go entirely offline — power outage, fire, tornado, ISP cable cut.

Amazon offers Availability Zones — physically separate buildings with independent power and networking. `us-east-1a`, `us-east-1b`, `us-east-1c` are different buildings in Virginia. Plus separate regions: US West, Europe, Asia, South America.

When Google returns multiple IPs for a DNS query, those aren't multiple load balancers in one building — they're different buildings in different countries. Global load balancing through DNS round-robin or geo-based routing sends users to the closest datacenter.

Every time Amazon goes down there's a wave of "cloud computing is unreliable!" But that's a misunderstanding. Cloud computing just means outsourcing infrastructure. The cloud isn't magically more reliable than your own servers by default — you still have to distribute across multiple independent datacenters yourself. Amazon has had outages spanning multiple Availability Zones simultaneously.

One more thing: if a browser has cached the IP of a failed datacenter, the failover won't happen until that DNS record's TTL expires — which could be minutes or days.

---

## 18. Security

The general rule is to open only the ports that are actually needed and give each component only the access it requires. This is called the principle of least privilege.

From the internet to the load balancer: allow `TCP 80` (HTTP), `TCP 443` (HTTPS), and `TCP 22` or a VPN port for admin SSH access — otherwise you'll lock yourself out.

From the load balancer to the web servers: only `TCP 80`. This is where SSL Termination happens: the balancer decrypts HTTPS traffic, and everything inside the datacenter runs on plain HTTP. The SSL certificate only goes on the load balancer, not every web server — saves money and simplifies management. You can put an expensive hardware crypto accelerator on the balancer and keep the web servers cheap. The tradeoff: if someone compromises the load balancer itself, all internal traffic is visible in plaintext. Most organizations consider that an acceptable risk.

From web servers to MySQL: only `TCP 3306`.

Why firewall internal datacenter traffic if everything's locked down from outside? If an attacker compromises a web server, without a firewall they can SSH into other machines, run arbitrary SQL commands, do whatever they want. With proper firewall rules, a compromised web server can only send MySQL queries to port 3306 — nothing else. There's no reason to keep port 3306 open to the internet: an unlocked door that nobody's supposed to use is always a risk.

---

*CS S75 — Lecture 9 | Scalability | David Malan, Harvard*
