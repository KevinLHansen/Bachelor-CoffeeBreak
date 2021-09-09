# CoffeeBreak
#### A Bachelor's Project by Kevin L. Hansen, Benjamin Klerens & Rasmus Stamm
CoffeeBreak is a generic RTC web application, built on the concepts of WebRTC, for verbal communication with others. Besides the obvious feature of Real Time Communications, CoffeeBreak aims to alleviate the challenge of conducting multiple verbal conversations in one *call* by dynamically adjusting each participant's volume level according to their distance to, and from other participants within a 2D meeting room canvas. In a nutshell, participants **close to you** will be relatively **coherent**, while participants **far from you** will be relatively **in-coherent**.

CoffeeBreak is built to be scalable through **Kubernetes**, where each *room*, when created by a user, is spun up as a new Pod. This means that, in theory, you could spin up an infinite amount of room Pods to alleviate a potentially growing number of desired ongoing calls.


The final **Project Report** which documents the entire process from start to finish can be found in repository root.
