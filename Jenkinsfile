
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
                    echo "Checking project files..."
                    test -f backend/Dockerfile
                    test -f backend/main.py
                    test -f frontend/Dockerfile
                    test -f docker-compose.yml
                    echo "All required project files are present."
                '''
            }
        }

        stage('Verify Docker Compose Config') {
            steps {
                sh '''
                    echo "Checking Docker Compose configuration..."
                    docker compose config -q
                '''
            }
        }

        stage('Build Status') {
            steps {
                echo 'DevNotes source checkout and configuration checks completed.'
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
