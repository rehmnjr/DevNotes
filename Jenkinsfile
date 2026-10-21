
pipeline {
    agent any

    options {
        timestamps()
    }

    stages {
        stage('Checkout') {
            steps {
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
                    echo "Required files verified."
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
                sh '''
                    docker build --platform linux/amd64 \
                      -t rehmnjr/devnotes-backend:latest ./backend
                '''
            }
        }

        stage('Build Frontend Image') {
            steps {
                sh '''
                    docker build --platform linux/amd64 \
                      -t rehmnjr/devnotes-frontend:latest ./frontend
                '''
            }
        }

        stage('Push Images to Docker Hub') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-creds',
                        usernameVariable: 'DOCKERHUB_USERNAME',
                        passwordVariable: 'DOCKERHUB_PASSWORD'
                    )
                ]) {
                    sh '''
                        set +x
                        echo "$DOCKERHUB_PASSWORD" | \
                          docker login -u "$DOCKERHUB_USERNAME" --password-stdin

                        docker push rehmnjr/devnotes-backend:latest
                        docker push rehmnjr/devnotes-frontend:latest

                        docker logout
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'DevNotes images built and pushed successfully!'
        }
        failure {
            echo 'Pipeline failed. Check Console Output.'
        }
    }
}
