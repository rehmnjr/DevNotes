# DevNotes — Problems Faced, Troubleshooting & Solutions

This document records the technical challenges encountered while building, containerizing, deploying, and validating the DevNotes application. It covers Docker, Jenkins, GitHub Actions, AWS infrastructure, database migration, networking, backups, and deployment verification.

The purpose is to document the actual engineering journey, including symptoms, resolutions, verification steps, and lessons learned.

> **Documentation note:** Issues are classified as resolved, partially addressed, or requiring further verification. Commands and configuration examples are illustrative unless explicitly identified as commands used during the project.

---

## 1. Project Context

DevNotes is a full-stack note-taking application with a React frontend and a FastAPI backend.

The project evolved from local containerization and CI experimentation into an AWS deployment with a managed MySQL database and S3 backup storage.

### Technologies involved

- React and Vite
- Python and FastAPI
- SQLAlchemy and SQLite
- MySQL on Amazon RDS
- Docker and Docker Compose
- Jenkins Declarative Pipeline
- Git and GitHub
- GitHub Actions
- Amazon EC2, VPC, IAM, S3, CloudWatch, and SNS

### Overall objective

Build a containerized application, validate the source code and container configuration through CI, deploy the application to AWS, persist data in RDS, and establish a backup and monitoring workflow.

---

## 2. Docker and Containerization Issues

### 2.1 Docker CLI missing inside Jenkins

**Problem**

Jenkins could not execute Docker commands because the Docker CLI was not available inside the Jenkins container.

**Root cause**

The Jenkins container and the Docker daemon are separate components. Having Jenkins installed does not automatically provide the Docker CLI or access to a Docker daemon.

**Resolution**

The Docker CLI was installed in the Jenkins environment, and its version was checked.

**Verification**

```bash
docker --version
```

**Lesson learned**

Installing Jenkins and installing the tools required by a Jenkins pipeline are separate tasks.

For a reproducible setup, required tools should be included in a maintained custom Jenkins image rather than installed manually after every container creation.

### 2.2 Docker socket permission denied

**Problem**

Jenkins could not access the Docker daemon through the mounted Docker socket.

**Root cause**

The Jenkins process did not have sufficient permissions to access the socket.

**Resolution**

Docker daemon connectivity was checked, and socket permissions were temporarily adjusted during local testing.

**Verification**

```bash
docker info
```

**Security consideration**

Making the Docker socket world-writable is not a safe permanent solution. Access to the Docker daemon can provide powerful control over the host.

A production configuration should use controlled permissions, a dedicated execution environment, or a more isolated build architecture.

### 2.3 Docker Compose command unavailable

**Problem**

Docker commands were available, but the Compose command was missing in the Jenkins environment.

**Root cause**

The Docker CLI and the Docker Compose plugin are separate components.

**Resolution**

A compatible Linux ARM64 Docker Compose plugin was installed and verified.

**Verification**

```bash
docker compose version
```

**Lesson learned**

Tool installation must match the operating system and CPU architecture of the environment where the pipeline runs.

### 2.4 Jenkins container recreation removed manually installed tools

**Problem**

Tools installed inside a running Jenkins container were lost when the container was recreated.

**Root cause**

Changes made inside a container's writable layer are not automatically preserved when the container is replaced.

**Resolution / recommended improvement**

Create a custom Jenkins image containing the required Docker CLI and Compose plugin.

Keep Jenkins configuration and important state in persistent storage where appropriate.

**Lesson learned**

Infrastructure should be reproducible. Manually modifying a running container is useful for experimentation, but it is not a reliable long-term deployment strategy.

### 2.5 Container data persistence

**Problem**

Application data must survive backend container replacement or recreation.

**Resolution**

Docker Compose uses a named volume for SQLite persistence in the local configuration.

```bash
docker compose down
```

This command does not remove named volumes by default.

**Important distinction**

```bash
docker compose down -v
```

also removes associated named volumes. It should not be used casually when persistent data needs to be retained.

The production application later used Amazon RDS for database persistence.

---

## 3. Jenkins CI Issues

### 3.1 Pipeline execution depended on external tools

**Problem**

Pipeline stages that validate Docker Compose and build container images could not run until Docker CLI, Compose, and daemon access were configured.

**Resolution**

The Jenkins environment was configured with the required tools and Docker connectivity.

**Lesson learned**

A Jenkins pipeline is only as reliable as its execution environment. Pipeline requirements should be documented and provisioned before a build is triggered.

### 3.2 CI success versus application deployment

**Problem**

A successful image build can be mistaken for a successful application deployment.

**Explanation**

Building frontend and backend images validates that the images can be produced. It does not prove that the application is running on EC2, that the API is reachable, or that database persistence works.

**Resolution**

Deployment was verified separately using application access, health checks, API requests, and database queries.

**Lesson learned**

CI validation, image publishing, deployment, and runtime verification are separate stages.

### 3.3 Jenkins and GitHub Actions have different roles

**Problem**

The repository contains both Jenkins-related CI documentation and a GitHub Actions workflow.

**Clarification**

Jenkins was used for pipeline learning and Docker build validation. GitHub Actions was also configured to run backend and frontend checks.

The existence of both systems does not mean they are automatically integrated into one pipeline.



---

## 4. GitHub Actions Issues

### 4.1 Workflow changes required Git reconciliation

**Problem**

Changes to the workflow and other repository files required reconciliation before the updated commit history could be pushed successfully.

**Resolution**

The changes were rebased and pushed successfully. The updated workflow commit was recorded in the repository.

**Lesson learned**

Before pushing workflow changes, check the current branch and working-tree state.

```bash
git status
git log --oneline -5
```

If local and remote branches have diverged, inspect the differences before rebasing or merging.

### 4.2 CI workflow did not perform continuous deployment

**Problem**

A passing GitHub Actions workflow could be interpreted as proof of automatic deployment.

**Root cause**

The workflow was configured to perform checks and build frontend/backend Docker images. It was not a complete automatic deployment pipeline to EC2.

**Resolution**

The application was deployed and verified separately on EC2.

**Current verified outcome**

- Backend workflow checks passed.
- Frontend workflow checks passed.
- The running application was verified independently.

**Recommended improvement**

If continuous deployment is required, add explicit image publishing, secure deployment credentials, deployment steps, and post-deployment health checks.

### 4.3 CI and CD documentation needed clearer boundaries

**Problem**

The project evolved from local CI experiments to AWS deployment, which can make it difficult to distinguish the capabilities of each stage.

**Resolution**

Document these stages separately:

1. Source-code checkout.
2. Code and configuration checks.
3. Docker image build.
4. Image publishing, if configured.
5. Deployment to EC2.
6. Runtime and database verification.


---

## 5. AWS Infrastructure and Networking Issues

### 5.1 VPC and subnet configuration

**Problem**

The application server and database needed a suitable network layout with controlled connectivity.

**Resolution**

A dedicated VPC was configured with public and private subnets, an Internet Gateway, route tables, and security groups. An S3 Gateway VPC endpoint was also created.

**Important distinction**

A public subnet's route to an Internet Gateway does not automatically make every resource publicly accessible. The resource also needs appropriate addressing and security-group rules.

**Lesson learned**

Subnet routes, IP addressing, security groups, and service-specific network settings work together. Each layer must be checked when diagnosing connectivity.

### 5.2 Security-group connectivity between EC2 and RDS

**Problem**

The application needed to reach the MySQL database without exposing the database directly to the public internet.

**Resolution**

The database security group was configured to allow MySQL traffic on port `3306` from the EC2 web-server security group.

The RDS instance was configured without public access.

**Verification**

Network connectivity from EC2 to the RDS endpoint was tested successfully using `nc`.

Example diagnostic command:

```bash
nc -vz <RDS-ENDPOINT> 3306
```

Replace the placeholder with the actual RDS endpoint.

**Lesson learned**

A successful TCP connection confirms network reachability, but it does not prove that database credentials, permissions, or application queries are correct.

### 5.3 DNS and endpoint verification

**Problem**

Cloud-hosted endpoints sometimes need separate DNS and application-level checks to determine where a failure occurs.

**Diagnostic approach**

For a public application endpoint, DNS resolution and HTTP responses can be checked separately.

```bash
dig +short <HOSTNAME>
curl -I http://<HOSTNAME>
```

**Lesson learned**

- DNS resolution confirms that a hostname resolves to an address.
- An HTTP response confirms that a server responded.
- An application health check provides stronger evidence that the service is functioning.

These checks should not be treated as interchangeable.

### 5.4 Elastic Beanstalk endpoint verification

During separate AWS environment troubleshooting, a test Elastic Beanstalk hostname was checked using `dig` and `curl`.

The hostname resolved to IP addresses, and the HTTP request returned `200 OK`.

**Lesson learned**

When an endpoint appears inaccessible in a browser, verify DNS resolution and HTTP response independently before changing network configuration.

This test belongs to the broader AWS troubleshooting history; it should not be represented as the mechanism used to deploy the DevNotes application unless that connection is explicitly established.

---

## 6. EC2 Deployment and Application Routing

### 6.1 Backend health check

**Problem**

A running container does not necessarily mean that the backend application is healthy.

**Resolution**

The backend health endpoint was checked inside the container and returned a healthy response.

The API was also tested through the Nginx frontend routing layer.

**Lesson learned**

Validate the backend directly and through the public routing path. This helps distinguish application errors from reverse-proxy or network errors.

### 6.2 Frontend-to-backend routing through Nginx

**Problem**

The frontend needed to reach the backend API when the application was accessed through the EC2 public endpoint.

**Resolution**

The frontend Nginx configuration was set up to proxy `/api/` requests to the backend service.

**Verification**

The API health endpoint was tested through Nginx and returned HTTP `200 OK`.

Example diagnostic request:

```bash
curl -i http://localhost/api/health
```

**Lesson learned**

Container-to-container communication and browser-to-application communication are different paths. Docker service names, listening ports, reverse-proxy configuration, and public security-group rules must agree.

### 6.3 Docker Compose environment configuration

**Problem**

The backend needed environment variables for database connectivity without hardcoding database credentials into the application source.

**Resolution**

The Compose configuration was updated to load backend environment variables from an `.env` file.

The environment file was stored on the EC2 instance with restrictive file permissions.

**Verification**

The application connected to RDS and successfully performed database operations.

**Security lesson**

Environment files should not be committed to GitHub. Use appropriate secrets-management practices and never paste database passwords into public documentation.

### 6.4 Deployment verification

**Problem**

Successful container startup alone was not sufficient evidence that the application was working end to end.

**Resolution**

The deployment was validated using:

- Application access through the EC2 public IP.
- Backend health checks.
- Nginx API routing.
- API write operations.
- RDS database queries.

**Lesson learned**

A deployment should be considered verified only after the application, network path, and persistent data layer have been tested.

---

## 7. SQLite to MySQL Migration

### 7.1 Moving from SQLite to Amazon RDS

**Problem**

The project initially used SQLite but was later configured to use managed MySQL on Amazon RDS.

**Root cause**

SQLite uses a local database file, whereas MySQL requires a database server, network connectivity, valid credentials, and a compatible database driver.

**Resolution**

The backend was updated to support a MySQL SQLAlchemy connection using PyMySQL. The backend requirements were updated, and the changes were committed to GitHub.

The application retained a SQLite fallback when `DB_HOST` was not configured.

**Illustrative connection format**

```text
mysql+pymysql://<USER>:<PASSWORD>@<HOST>:3306/<DATABASE>
```

Use environment variables for actual credentials. Do not place real passwords in source code or documentation.

### 7.2 Database driver and dependency configuration

**Problem**

The backend needed the correct database driver to establish a SQLAlchemy connection to MySQL.

**Resolution**

`pymysql` was added to the backend requirements.

The backend image was rebuilt and deployed with the updated dependency configuration.

**Lesson learned**

Changing the database engine requires changes to the application configuration, installed dependencies, connection settings, and data migration procedure.

### 7.3 Migrating existing SQLite data

**Problem**

Changing the database connection does not automatically copy existing SQLite records into MySQL.

**Resolution**

The existing notes were migrated to the RDS database.

The migrated data was checked, and an additional test note was created through the deployed API.

**Verification evidence**

A test API request created a note with ID `5`, and a subsequent RDS query returned the corresponding record.

The database contained four note records at the time of the recorded count; the highest observed ID was `5`. Gaps in generated IDs do not necessarily indicate a migration failure.

**Lesson learned**

Database connectivity, schema initialization, data migration, and application-level CRUD operations should be verified separately.

### 7.4 Database persistence test

**Problem**

An API returning success does not by itself prove that data has been committed to the intended database.

**Resolution**

A note was created through the deployed API and then checked directly in RDS.

**Lesson learned**

Use an end-to-end write followed by a database read to validate the persistence layer.

---

## 8. S3 Backup and IAM Configuration

### 8.1 EC2 access to S3

**Problem**

The EC2 instance needed permission to interact with the project's S3 bucket for backup and operational tasks.

**Resolution**

An EC2 IAM role was configured with access limited to the DevNotes bucket and relevant supporting permissions.

**Lesson learned**

Use instance roles rather than storing long-lived AWS access keys on the server. Apply least privilege and grant only the permissions needed by the scripts.

### 8.2 Creating database backups

**Problem**

A database backup needed to be created and stored independently of the running application.

**Resolution**

A backup script was used to create a SQLite database backup and upload it to the S3 `backups/` prefix.

The project also retained a pre-migration SQLite backup on EC2.

**Lesson learned**

A backup script should report failures clearly and verify that the expected output exists before uploading it.

**Important limitation**

A SQLite backup created before the RDS migration is not necessarily a current backup of the MySQL database. The database source and backup timestamp must be documented.

### 8.3 Verifying an S3 backup

**Problem**

The existence of an S3 object does not guarantee that its contents are valid or recoverable.

**Resolution**

A `.db` backup file was downloaded from S3 to the local Mac.

The following integrity check returned `ok`:

```bash
sqlite3 ~/Downloads/devnotes-20261022-110717.db \
  "PRAGMA integrity_check;"
```

**Verified result**

The downloaded SQLite file passed SQLite's structural integrity check.

**Important limitation**

This confirms the integrity of that SQLite file. It does not prove that it contains the latest RDS MySQL data or that a full application restore has been tested.

### 8.4 Backup retention and recovery planning

**Problem**

Cleaning up cloud resources can remove access to live databases and application infrastructure.

**Resolution**

Screenshots were collected, and a verified SQLite backup was downloaded before cleanup planning.

**Recommended improvement**

Before deleting RDS, decide whether the latest MySQL data must be retained. If it must, export the current RDS data or create a final snapshot and account for any associated storage charges.

A recoverable backup should be tested, not merely stored.

---

## 9. Monitoring, Notifications, and Cost Management

### 9.1 CloudWatch alarm configuration

**Problem**

The project needed basic monitoring for high EC2 CPU utilization.

**Resolution**

A CloudWatch alarm was configured for CPU utilization above 70%, with an SNS notification topic.

An email subscription was confirmed.

**Verification status**

The alarm and email subscription were configured. A successful end-to-end alarm-trigger test was not confirmed in the available project record.

**Lesson learned**

An alarm configuration and a confirmed notification test are different levels of verification.

### 9.2 AWS budget versus a spending limit

**Problem**

AWS charges caused concern during project testing, and a monthly budget was configured.

**Clarification**

An AWS Budget is an alerting and tracking mechanism. A budget threshold does not automatically stop all resources or guarantee that spending cannot exceed the threshold.

**Resolution / next step**

Review running resources and remove those no longer required. Check the billing dashboard for ongoing charges and account for delayed billing updates.

### 9.3 Safe AWS cleanup

**Problem**

Leaving test infrastructure running can generate unnecessary charges after a project is complete.

**Approach**

1. Save project screenshots and documentation.
2. Download and verify necessary backups.
3. Decide whether the latest RDS data needs to be retained.
4. Remove paid resources in dependency order.
5. Release unused Elastic IP addresses.
6. Remove network resources after dependent resources are deleted.
7. Retain or delete S3 backups intentionally.
8. Review billing and confirm that unnecessary resources are gone.

**Lesson learned**

Cleanup must consider dependencies. For example, a VPC cannot be deleted while dependent network resources remain, and a security group cannot be deleted while it is still attached to a resource.

---


## 10. Security Lessons

- Never commit `.env` files containing credentials.
- Do not expose RDS directly to the public internet when private access is sufficient.
- Restrict SSH access to trusted IP addresses.
- Avoid permanently making Docker sockets world-writable.
- Use IAM roles for EC2-to-S3 access.
- Apply least-privilege permissions to IAM policies.
- Keep backup files outside the application container.
- Verify backups before deleting infrastructure.
- Do not publish AWS account credentials, secret values, or private keys in GitHub documentation.
- Review screenshots before uploading them to a public repository.
- Use a final RDS snapshot or database export when the latest MySQL data must be retained.

---

## 11. Final Lessons Learned

This project provided hands-on experience with several important DevOps principles:

1. **Containerization:** Applications need reproducible images and explicit dependency management.
2. **CI pipelines:** Successful builds validate specific stages, not the entire deployment.
3. **Networking:** DNS, routes, security groups, service ports, and reverse proxies must be diagnosed separately.
4. **Database migration:** Switching database engines requires driver configuration, data migration, and persistence verification.
5. **Backups:** Backup existence and backup recoverability are different things.
6. **IAM:** Instance roles provide a safer alternative to long-lived credentials on EC2.
7. **Monitoring:** Configuring an alarm is not the same as proving that notifications work.
8. **Cost control:** Budgets do not automatically stop resources, so infrastructure cleanup is an important operational task.
9. **Documentation:** Recording real problems and their resolutions makes a project easier to maintain, reproduce, and explain in interviews.

---

**Project repository:** https://github.com/rehmnjr/DevNotes
