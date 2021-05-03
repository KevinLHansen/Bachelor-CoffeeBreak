# Bachelor-CoffeeBreak
## Deployment & Install
### Building Docker Image
Navigate to root project folder:  
    ``docker build . -t benjaminhck/<name of build type>``  
    tag for build is benjaminhck/coffeebreak-web OR benjamin/coffeebreak-proxy,  
    dependant on the build type.  
    
### Running the docker image
Example:  
``docker run --rm -p 8080:8080/tcp coffeebreak:v1``

--rm for automatic removal of container on exit
-p for publishing container ports to host port, syntax is   
``<container-port>:<host-port>/<protocol>``

### Pushing to DockerHub
FOR COLLABORATORS ONLY  
``docker push benjaminhck/coffeebreak:latest``  

### Kubernetes
Create the coffeebreak namespace  
``kubectl create namespace coffeebreak``

Apply the deployment and service file to the namespace  
``kubectl -n coffeebreak apply -f deployment/deployment.yaml``   
``kubectl -n coffeebreak apply -f deployment/service.yaml``  

Useful command to get overall status of namespace  
``kubectl -n coffeebreak get all -o wide``


