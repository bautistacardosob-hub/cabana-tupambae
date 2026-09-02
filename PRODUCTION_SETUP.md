#lo primero que haremos sera borrar la memoria del trabajo
rm(list=ls())
#establecemos el directorio de trbajo
setwd("~/Documents/PET_ORT")
MY_DATA <- read_excel("BBB.xlsx")
View(MY_DATA) 
str(MY_DATA)

