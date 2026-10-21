
pipeline {
    agent any

    options {
        timestamps()
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out DevNotes source code'
                checkout scm
                sh 'git log -1 --oneline'
            }
        }

        stage('Verify Project Structure') {
            steps {
                sh '''
                    test -f backend/Dockerfile
                    test -f backend/main.py
                    test -f frontend/Dockerfile
                    test -f docker-compose.yml
                    echo "All required files are present."
                '''
            }
        }

        stage('Verify Docker Compose Config') {
            steps {
                sh 'docker compose config -q'
            }
        }

        stage('Build Backend Image') {
            steps {
                sh 'docker build -t devnotes-backend:latest ./backend'
            }
        }

        stage('Build Frontend Image') {
            steps {
                sh 'docker build -t devnotes-frontend:latest ./frontend'
            }
        }
    }

    post {
        success {
            echo 'DevNotes CI pipeline completed successfully!'
        }
        failure {
            echo 'DevNotes CI pipeline failed. Check Console Output.'
        }
    }
}
