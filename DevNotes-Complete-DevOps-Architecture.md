<div align="center">

# DevNotes — Complete DevOps Architecture

### GitHub • GitHub Actions • Jenkins • Docker • Docker Hub • AWS

**A practical guide to how the source code, CI workflows, container images, AWS infrastructure, deployment, database, backups, and monitoring connect together.**

![Architecture overview](./docs/CompleteArchitecture)

> If you do not keep the architecture image in `docs/images/`, remove the image line above or update its path.

</div>

---

## Contents

- [1. Project overview](#1-project-overview)
- [2. Architecture overview](#2-architecture-overview)
- [3. How the tools connect](#3-how-the-tools-connect)
- [4. GitHub repository structure](#4-github-repository-structure)
- [5. GitHub Actions CI workflow](#5-github-actions-ci-workflow)
- [6. Jenkins pipeline](#6-jenkins-pipeline)
- [7. Docker and Docker Hub](#7-docker-and-docker-hub)
- [8. AWS infrastructure](#8-aws-infrastructure)
- [9. End-to-end pipeline](#9-end-to-end-pipeline)
- [10. Networking and security](#10-networking-and-security)
- [11. Database and backups](#11-database-and-backups)
- [12. Monitoring and notifications](#12-monitoring-and-notifications)
- [13. Commands for verification](#13-commands-for-verification)
- [14. Evidence screenshots](#14-evidence-screenshots)
- [15. Important implementation boundaries](#15-important-implementation-boundaries)

---

## 1. Project overview

**DevNotes** is a full-stack web application with a React frontend and a FastAPI backend. Docker packages the application components into containers. GitHub stores the source code, GitHub Actions checks that the backend and frontend Docker images can build, and Jenkins runs a separate pipeline for additional build and delivery steps. Docker Hub stores published container images, while AWS provides the runtime infrastructure and supporting services.

### Technology stack

| Layer | Technology | Responsibility |
|---|---|---|
| Source control | Git, GitHub | Stores code and tracks changes |
| Continuous integration | GitHub Actions | Automatically builds backend and frontend images on pushes and pull requests to `main` |
| Pipeline orchestration | Jenkins | Checks out the repository and runs the configured pipeline stages |
| Containerization | Docker | Packages frontend and backend into reproducible images |
| Image registry | Docker Hub | Stores versioned container images |
| Web entry point | Nginx | Serves/proxies HTTP traffic on the EC2 host |
| Compute | Amazon EC2 | Runs the application host |
| Database | Amazon RDS for MySQL | Stores application data |
| Object storage | Amazon S3 | Stores the documented backup files |
| Monitoring | Amazon CloudWatch | Tracks EC2 metrics and evaluates alarms |
| Notifications | Amazon SNS | Sends alarm notifications to a confirmed email subscription |
| Identity and permissions | AWS IAM | Grants AWS permissions to users and the EC2 role |
| Network isolation | Amazon VPC | Provides the private network, subnets, routes, and security groups |
| Cost alerts | AWS Budgets | Notifies about configured spending thresholds; it does not impose a hard spending cap |

---

## 2. Architecture overview

```text
DEVELOPER
   |
   | git push / pull request
   v
GITHUB REPOSITORY (main)
   |                                  \
   | push / pull_request               \ Jenkins checks out Jenkinsfile
   v                                    v
GITHUB ACTIONS CI                     JENKINS PIPELINE
   |                                    |
   | build backend image                | checkout source
   | build frontend image               | verify project/config
   | report success/failure              | build Docker images
   v                                    | push images (configured stage)
CI RESULT                                | optional deployment stage
                                        v
                                  DOCKER HUB
                             backend + frontend images
                                        |
                                        | EC2 pulls image tags
                                        v
                          AWS REGION: ap-south-1 (Mumbai)
                          ┌─────────────────────────────┐
                          │ VPC: DevNotes-VPC-vpc       │
                          │                             │
Browser -- HTTP :80 -->   │ Public networking path      │
                          │  EC2: DevNotes-Web-Server   │
                          │  Amazon Linux 2023          │
                          │  ┌───────────────────────┐  │
                          │  │ Nginx / port 80       │  │
                          │  │ React frontend        │  │
                          │  │ FastAPI backend       │  │
                          │  └──────────┬────────────┘  │
                          │             │ MySQL :3306   │
                          │             v               │
                          │  RDS: database-1            │
                          │  private / not public       │
                          └─────────────────────────────┘
                                      |
                     ┌────────────────┼────────────────┐
                     v                v                v
                   S3            CloudWatch           IAM
             backup objects      EC2 metrics       EC2 role
                                      |
                                  CPU alarm
                                      |
                                      v
                                     SNS
                              confirmed email endpoint
```

**Important:** The diagram represents the intended system relationship. The currently documented GitHub Actions workflow builds images for validation; it does not push images or deploy to EC2. The Jenkins screenshot shows a pipeline with a Docker Hub push stage and an optional EC2 deployment stage, but do not claim those stages are fully automatic unless the actual `Jenkinsfile` and build logs verify it.

---

## 3. How the tools connect

### Connection map

| From | To | Connection | What it achieves |
|---|---|---|---|
| Developer | GitHub | Git push / pull request | Publishes code changes |
| GitHub | GitHub Actions | Workflow trigger | Starts CI jobs |
| GitHub | Jenkins | Jenkins Git SCM configuration | Jenkins checks out the repository |
| GitHub Actions | Docker | `docker build` commands on the runner | Verifies each Docker build |
| Jenkins | Docker | Shell steps in `Jenkinsfile` | Builds images on the Jenkins agent |
| Jenkins | Docker Hub | Docker Hub credentials + `docker push` | Publishes image tags, if configured |
| EC2 | Docker Hub | `docker pull` or Compose image reference | Downloads the application images |
| Browser | EC2/Nginx | HTTP on port 80 | Opens the website |
| Nginx/frontend | FastAPI backend | Container or proxy network | Sends API requests to the backend |
| Backend | RDS MySQL | Private VPC connection on port 3306 | Reads and writes notes |
| EC2 backup script | S3 | EC2 instance role | Uploads the documented backup files |
| EC2 | CloudWatch | EC2 metrics | Provides CPU utilization data |
| CloudWatch alarm | SNS | Alarm action | Publishes an alert |
| SNS | Email endpoint | Confirmed subscription | Delivers notifications when an action publishes a message |

### CI versus CD

- **CI (Continuous Integration):** Checks that code can be checked out and the frontend/backend images can be built.
- **CD (Continuous Delivery/Deployment):** Publishes the built images and deploys a selected version to the runtime environment.
- A green build does not by itself prove that the application was deployed. Deployment needs explicit stages, credentials, and successful deployment logs.

---

## 4. GitHub repository structure

The project repository is [rehmnjr/DevNotes](https://github.com/rehmnjr/DevNotes).

```text
DevNotes/
├── .github/
│   └── workflows/
│       └── deploy.yml       # GitHub Actions CI workflow
├── backend/                 # FastAPI application and Dockerfile
├── frontend/                # React application and Dockerfile
├── docker-compose.yml       # Multi-container application configuration
├── Jenkinsfile              # Jenkins pipeline definition
├── README.md                # Project introduction and setup
├── PROBLEM.md               # Problem statement / project notes
├── AWSArchitectureWebApp.md # AWS architecture documentation
└── AWS_WebApp_Architecture_implementation.pdf
```

The exact repository contents can change. Check GitHub before relying on this tree as a current listing.

### Why keep `Jenkinsfile` in the repository?

The `Jenkinsfile` stores pipeline-as-code alongside the application. Jenkins can read it from source control so pipeline changes can be reviewed and versioned with the project.

### Why keep the GitHub Actions workflow under `.github/workflows/`?

GitHub automatically discovers YAML workflow files in this directory. A workflow defines its triggers, jobs, runner environment, and steps.

---

## 5. GitHub Actions CI workflow

The documented workflow is named `DevNotes CI`. It runs on pushes and pull requests targeting `main` and has separate backend and frontend image-build jobs.

```yaml
name: DevNotes CI

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  backend-check:
    name: Backend Check
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build backend Docker image
        run: docker build -t devnotes-backend ./backend

  frontend-check:
    name: Frontend Check
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build frontend Docker image
        run: docker build -t devnotes-frontend ./frontend
```

### Explanation

1. `name: DevNotes CI` gives the workflow its display name.
2. `on.push.branches: main` triggers the workflow when code is pushed to `main`.
3. `on.pull_request.branches: main` triggers checks for pull requests targeting `main`.
4. `jobs` defines the independent jobs that GitHub Actions runs.
5. `backend-check` is the internal job identifier.
6. `runs-on: ubuntu-latest` requests a GitHub-hosted Ubuntu runner.
7. `actions/checkout@v4` checks the repository code out onto the runner.
8. `docker build -t devnotes-backend ./backend` builds an image from the backend directory and tags it `devnotes-backend`.
9. `frontend-check` independently validates the frontend Docker build.
10. `docker build -t devnotes-frontend ./frontend` builds an image from the frontend directory.
11. If a build command fails, its job fails and the workflow reports the failure.

### What this workflow does not do

This YAML does **not** log in to Docker Hub, push an image, connect to EC2, or restart the application. The image tags are local to the temporary runner. Those actions require additional steps and securely configured credentials.

---

## 6. Jenkins pipeline

The Jenkins job shown in the project evidence is named **`DevNotes-CI`**. Its description identifies a pipeline for the React frontend, FastAPI backend, and Docker Compose.

The captured Stage View includes these stages:

1. Declarative: Checkout SCM
2. Checkout
3. Verify Project Structure
4. Verify Docker Compose Config
5. Build Backend Image
6. Build Frontend Image
7. Push Images to Docker Hub
8. Declarative: Post Actions

### What each stage means

| Stage | Purpose |
|---|---|
| Checkout SCM | Jenkins loads the pipeline definition from source control |
| Checkout | Retrieves the project files from GitHub |
| Verify Project Structure | Checks that expected files and folders exist |
| Verify Docker Compose Config | Validates the Compose configuration before deployment |
| Build Backend Image | Builds the FastAPI backend image |
| Build Frontend Image | Builds the React frontend image |
| Push Images to Docker Hub | Publishes images if registry authentication and push commands are configured |
| Post Actions | Performs configured final reporting or cleanup |

The Jenkins configuration screenshot shows Git SCM pointing to `https://github.com/rehmnjr/DevNotes.git`, branch specifier `*/main`, and script path `Jenkinsfile`.

### Jenkins controller and agent

- **Controller:** Hosts the Jenkins web UI, schedules jobs, and coordinates pipeline execution.
- **Agent/worker:** Executes pipeline steps such as checkout, Docker builds, and shell commands.
- Docker must be installed and usable by whichever agent runs Docker commands. A controller should not be assumed to be the build worker unless the node configuration says so.

### Jenkins pipeline example

The following is an illustrative pattern, not a claim that it exactly matches the current `Jenkinsfile`. Adapt it to the repository and configured credentials before using it.

```groovy
pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Verify Project Structure') {
            steps {
                sh 'test -f backend/Dockerfile'
                sh 'test -f frontend/Dockerfile'
                sh 'test -f docker-compose.yml'
            }
        }

        stage('Verify Docker Compose Config') {
            steps {
                sh 'docker compose config -q'
            }
        }

        stage('Build Backend Image') {
            steps {
                sh 'docker build -t rehmnjr/devnotes-backend:latest ./backend'
            }
        }

        stage('Build Frontend Image') {
            steps {
                sh 'docker build -t rehmnjr/devnotes-frontend:latest ./frontend'
            }
        }

        // Add authenticated Docker Hub push and deployment stages only
        // after configuring Jenkins credentials and the target host.
    }

    post {
        success {
            echo 'DevNotes pipeline completed successfully.'
        }
        failure {
            echo 'DevNotes pipeline failed. Review the stage logs.'
        }
    }
}
```

### Important Docker Compose note

The project EC2 terminal showed:

```text
docker: 'compose' is not a docker command.
```

That means the Docker Compose plugin was unavailable under that command on the host at that time. Do not assume `docker compose` works on EC2 until it is installed and verified. The Jenkins agent may have a different Docker installation, so test there separately.

---

## 7. Docker and Docker Hub

### Docker's role

Docker packages application code and its runtime dependencies into images. A container is a running instance of an image.

- **Dockerfile:** Instructions for building one image.
- **Image:** The packaged application artifact.
- **Container:** A running instance of an image.
- **Docker Compose:** A configuration tool for defining multiple related containers and their networks, ports, environment, and volumes.
- **Docker Hub:** A registry where images can be stored and pulled by other machines.

### Images documented in the project

The Docker Hub screenshot shows these repositories under the `rehmnjr` namespace:

- [devnotes-backend](https://hub.docker.com/r/rehmnjr/devnotes-backend)
- [devnotes-frontend](https://hub.docker.com/r/rehmnjr/devnotes-frontend)

The local terminal screenshot also shows local image names including `devnotes-backend:latest`, `devnotes-frontend:latest`, `rehmnjr/devnotes-backend:latest`, and `rehmnjr/devnotes-frontend:latest`.

### Common Docker commands

Run these from the repository root where the relevant files exist.

```bash
# Build the backend image
docker build -t rehmnjr/devnotes-backend:latest ./backend

# Build the frontend image
docker build -t rehmnjr/devnotes-frontend:latest ./frontend

# List local images
docker images

# List running containers
docker ps

# List all containers, including stopped containers
docker ps -a
```

To push to Docker Hub, authenticate with a Docker Hub account that has permission to the repositories, then push the correctly tagged images:

```bash
docker login
docker push rehmnjr/devnotes-backend:latest
docker push rehmnjr/devnotes-frontend:latest
```

Do not put a Docker Hub password or access token directly into source code or a committed shell script. In automation, use Jenkins credentials or GitHub Actions secrets.

### Local versus AWS containers

The local terminal screenshot shows containers named `jenkins-server`, `devnotes-ui`, and `devnotes-api`. These are local development/runtime containers; they are not proof that the same containers are running on EC2. The EC2 host and local Mac have separate Docker environments.

---

## 8. AWS infrastructure

The documented AWS region is **Asia Pacific (Mumbai), `ap-south-1`**.

### Resource inventory

| Resource | Documented name / identifier | Role |
|---|---|---|
| VPC | `DevNotes-VPC-vpc` / `vpc-0f132930898a5967e` | Isolated project network |
| EC2 instance | `DevNotes-Web-Server` / `i-0949f90cacaef480b` | Hosts the web application |
| EC2 type | `t3.micro` | Small general-purpose compute |
| Operating system | Amazon Linux 2023 | EC2 host OS |
| Web security group | `DevNotes-Web-SG` | HTTP and restricted SSH ingress |
| DB security group | `DevNotes-DB-SG` | Controls MySQL ingress |
| RDS instance | `database-1` | MySQL database |
| RDS class | `db.t4g.micro` | Small database instance |
| S3 bucket | `devnotes-attachments-607252889349` | Stores documented backup files |
| IAM role | `DevNotes-EC2-S3-Role` | Grants permitted AWS access to EC2 |
| CloudWatch alarm | `DevNotes-High-CPU-Alarm` | Evaluates EC2 CPU utilization |
| SNS topic | `fahim-project2-alerts` | Alarm notification destination |
| AWS Budget | `DevNotes-Monthly-Budget` | Cost threshold notifications |

### EC2 and the application

The EC2 host runs Amazon Linux 2023. Nginx was installed as a system service and enabled at startup. The application was also run in Docker containers.

The documented public application URL used the EC2 public IPv4 address on HTTP port 80. A public IP can change if an instance is stopped and started unless an Elastic IP is configured and retained.

### RDS and application data

The backend was configured to connect to the RDS MySQL endpoint on port 3306. The RDS screenshot shows **Publicly accessible: No**, which is the expected safer configuration for an application database. The backend needs the appropriate connection settings and the EC2 security group must be allowed by the RDS security group.

### S3 backup bucket

The S3 bucket is private by design. The PDF documents two SQLite `.db` objects in `backups/`, each approximately 12 KB. These prove that backup files were uploaded, but they do not prove that current RDS MySQL data is backed up.

### IAM role

The EC2 role `DevNotes-EC2-S3-Role` is intended to permit the instance to access the project S3 bucket without embedding long-lived AWS keys on the server. Review its policies to confirm that permissions are limited to the required bucket and operations.

---

## 9. End-to-end pipeline

### Flow A — Code validation

1. A developer changes code and pushes to GitHub or opens a pull request targeting `main`.
2. GitHub Actions starts the `DevNotes CI` workflow.
3. The backend job checks out the code and builds the backend image.
4. The frontend job checks out the code and builds the frontend image.
5. GitHub reports success only if the required jobs pass.

**Output:** A CI result and validated image builds on the runner. The workflow shown does not publish images to Docker Hub.

### Flow B — Jenkins build and image publication

1. Jenkins reads `Jenkinsfile` from the GitHub repository.
2. Jenkins checks out the `main` branch.
3. It verifies required project files and the Docker Compose configuration.
4. It builds backend and frontend images.
5. The configured Docker Hub stage can publish tagged images when credentials and push commands are available.
6. An optional deployment stage can update EC2, but it must be explicitly implemented and verified.

**Output:** Build results, and—if configured and successful—published images.

### Flow C — Runtime on AWS

1. EC2 pulls the intended backend and frontend image tags from Docker Hub.
2. Docker/Compose starts the containers using the host's configured environment variables.
3. Nginx receives browser HTTP traffic on port 80.
4. Nginx serves the frontend and routes API requests to the backend.
5. The backend uses its RDS connection settings to read and write MySQL data.
6. The EC2 role is used for permitted S3 access by the backup process.

**Output:** A running application, with application data stored in RDS.

### Flow D — Monitoring and alerts

1. CloudWatch receives EC2 CPU utilization metrics.
2. `DevNotes-High-CPU-Alarm` evaluates the metric against its threshold.
3. When the alarm condition is met, CloudWatch invokes its configured alarm action.
4. SNS publishes the notification to the confirmed email subscription.

**Output:** A monitoring signal and an email notification, if the alarm action is configured and the notification is delivered.

---

## 10. Networking and security

### Security group rules documented

| Security group | Rule | Source | Meaning |
|---|---|---|---|
| `DevNotes-Web-SG` | TCP 80 / HTTP | `0.0.0.0/0` | Public web access |
| `DevNotes-Web-SG` | TCP 22 / SSH | One IPv4 `/32` source address shown in evidence | SSH access restricted to one address |
| `DevNotes-DB-SG` | TCP 3306 / MySQL | Intended source: `DevNotes-Web-SG` | Database access from the app tier |

Security group names alone do not enforce the rule; verify the actual inbound rules in AWS.

### Security practices

- Keep RDS private; do not add a public inbound rule for port 3306.
- Restrict SSH to a trusted IP and update the rule when that IP changes.
- Keep `.env`, PEM keys, AWS access keys, and registry credentials out of Git.
- Use an EC2 IAM role instead of storing AWS credentials on the host.
- Use Jenkins credentials for Docker Hub or deployment secrets.
- Prefer versioned, immutable image tags for traceable releases instead of relying only on `latest`.
- Keep security group rules narrow and review IAM policies regularly.

---

## 11. Database and backups

The project originally used SQLite and later migrated the backend to RDS MySQL. The documented S3 backups are files ending in `.db`, indicating SQLite backup files.

This distinction matters:

- A SQLite `.db` file is not automatically a MySQL/RDS backup.
- The existence of S3 objects proves file storage, not recoverability of current RDS data.
- To protect the current database, configure and test an appropriate RDS snapshot/export or MySQL logical backup process.
- Test restoration to a separate database before depending on a backup for disaster recovery.

Never commit database passwords or copy production data into a public GitHub repository.

---

## 12. Monitoring and notifications

### CloudWatch alarm configuration documented

| Setting | Value |
|---|---|
| Alarm | `DevNotes-High-CPU-Alarm` |
| Namespace | `AWS/EC2` |
| Metric | `CPUUtilization` |
| Statistic | Average |
| Threshold | Greater than 70% |
| Evaluation period | 5 minutes |
| Datapoints to alarm | 1 out of 1 |
| Instance | `i-0949f90cacaef480b` |

Screenshots captured at different times showed the alarm in both **OK** and **Insufficient data** states. Insufficient data means CloudWatch did not have enough usable datapoints to determine the alarm state at that moment.

### SNS configuration documented

| Setting | Value |
|---|---|
| Topic | `fahim-project2-alerts` |
| Type | Standard |
| Email subscription | Confirmed |

A confirmed email subscription means the endpoint completed confirmation. To prove end-to-end alerting, verify that the CloudWatch alarm action points to this topic and conduct a safe test.

### AWS Budgets

The project budget is documented as `DevNotes-Monthly-Budget`, with a `$1.00` threshold and actual/forecast alerts. Budgets sends alerts; it does not automatically stop resources or cap spending.

---

## 13. Commands for verification

### Local Mac — repository root

```bash
# Confirm the current Git branch and working-tree status
git status
git branch --show-current

# List project files
ls -la

# Build application images locally
docker build -t devnotes-backend ./backend
docker build -t devnotes-frontend ./frontend

# Inspect local images and containers
docker images
docker ps -a
```

### Check Docker Compose availability

The project EC2 screenshot showed that `docker compose` was not available on the EC2 host at that time. Check the environment before using Compose commands:

```bash
docker --version
docker compose version
```

If the second command fails, the Compose plugin is missing or unavailable in that Docker installation. Install the compatible Compose plugin for that environment before running `docker compose` commands. Do not assume the local Mac and EC2 have identical Docker tooling.

### EC2 host

```bash
# Check Nginx service
sudo systemctl status nginx

# Check running containers (if Docker is installed)
docker ps

# Check host's HTTP response locally
curl -I http://localhost
```

Run application-specific API health checks only if the backend health route is configured. Avoid printing `.env` files or secrets in logs or screenshots.

---

## 14. screenshots

The project evidence should show each layer clearly:

| Evidence | What it proves |
|---|---|
| GitHub repository tree | Source code, workflow, and `Jenkinsfile` are stored in GitHub |
| GitHub Actions run with green jobs | Backend and frontend image builds passed |
| Jenkins Stage View | The displayed pipeline stages completed in that build |
| Docker Hub repositories | Backend and frontend image repositories exist |
| Local `docker ps -a` and `docker images` | Local containers and images at the capture time |
| EC2 instance details | Instance identity, type, state, and Availability Zone |
| Nginx service status | Nginx was running at capture time |
| RDS details | Database engine, class, endpoint, and private accessibility |
| S3 `backups/` listing | Backup objects were present in the bucket |
| CloudWatch alarm details | Metric threshold and alarm configuration |
| SNS topic/subscription | Notification topic and confirmed email subscription |
| IAM role policies | The policies attached to the EC2 role |

Screenshots prove only the state visible when they were captured. For a public portfolio, hide account identifiers, email addresses, public IPs where appropriate, database endpoints if you prefer, and any secrets.

---

## 15. Important implementation boundaries

Keep these statements accurate in a portfolio or interview:

1. **GitHub Actions:** The supplied YAML runs backend and frontend Docker builds on pushes and pull requests to `main`. It does not publish images or deploy to EC2.
2. **Jenkins:** The captured Jenkins Stage View shows a successful build with verification, Docker build, and Docker Hub push stages. Confirm the `Jenkinsfile` and build logs before stating that all stages are always automated.
3. **EC2 Docker Compose:** The EC2 terminal evidence showed `docker compose` was unavailable at that capture time. Verify the current installation before describing Compose as working on EC2.
4. **S3 backups:** The documented `.db` files are SQLite backups; do not describe them as verified backups of current RDS MySQL data.
5. **SNS alerts:** A confirmed subscription does not by itself prove that a real CloudWatch alarm email was delivered.
6. **AWS Budget:** The budget generates alerts; it is not a hard spending cap.
7. **Deployment automation:** Only call the workflow end-to-end CI/CD if a tested deployment stage pulls the intended image version, restarts/updates the service, and verifies application health.

---

## Related project links

- [DevNotes GitHub repository](https://github.com/rehmnjr/DevNotes)
- [Backend Docker Hub repository](https://hub.docker.com/r/rehmnjr/devnotes-backend)
- [Frontend Docker Hub repository](https://hub.docker.com/r/rehmnjr/devnotes-frontend)
- [AWS architecture documentation](AWSArchitectureWebApp.md)


---

<div align="center">

**DevNotes DevOps Project**

*Source control → CI checks → Jenkins pipeline → Docker images → AWS runtime → database, backups, monitoring and alerts.*

</div>
