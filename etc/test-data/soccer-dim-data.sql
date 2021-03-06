-- 10 biggest stadion
INSERT INTO Venue(Name) VALUES('Camp Nou');
INSERT INTO Venue(Name) VALUES('Wembley Stadium');
INSERT INTO Venue(Name) VALUES('Croke Park');
INSERT INTO Venue(Name) VALUES('Twickenham Stadium');
INSERT INTO Venue(Name) VALUES('San Siro');
INSERT INTO Venue(Name) VALUES('Westfalenstadion');
INSERT INTO Venue(Name) VALUES('Stade de France');
INSERT INTO Venue(Name) VALUES('Santiago Bernabéu');
INSERT INTO Venue(Name) VALUES('Luzhniki Stadium');
INSERT INTO Venue(Name) VALUES('Atatürk Olympic Stadium');

-- most valuable teams
INSERT INTO Team (Name, Country) VALUES('Real Madrid ', 'Spain');
INSERT INTO Team (Name, Country) VALUES('FC Barcelona ', 'Spain');
INSERT INTO Team (Name, Country) VALUES('Manchester United ', 'England');
INSERT INTO Team (Name, Country) VALUES('Bayern Munich ', 'Germany');
INSERT INTO Team (Name, Country) VALUES('Manchester City ', 'England');
INSERT INTO Team (Name, Country) VALUES('Chelsea ', 'England');
INSERT INTO Team (Name, Country) VALUES('Arsenal ', 'England');
INSERT INTO Team (Name, Country) VALUES('Liverpool ', 'England');
INSERT INTO Team (Name, Country) VALUES('Juventus ', 'Italy');
INSERT INTO Team (Name, Country) VALUES('Milan ', 'Italy');
INSERT INTO Team (Name, Country) VALUES('Borussia Dortmund ', 'Germany');
INSERT INTO Team (Name, Country) VALUES('Paris Saint-Germain ', 'France');
INSERT INTO Team (Name, Country) VALUES('Tottenham Hotspur ', 'England');
INSERT INTO Team (Name, Country) VALUES('Schalke 04 ', 'Germany');
INSERT INTO Team (Name, Country) VALUES('Internazionale ', 'Italy');
INSERT INTO Team (Name, Country) VALUES('Atlético Madrid ', 'Spain');
INSERT INTO Team (Name, Country) VALUES('Napoli ', 'Italy');
INSERT INTO Team (Name, Country) VALUES('Newcastle United ', 'England');
INSERT INTO Team (Name, Country) VALUES('West Ham United ', 'England');
INSERT INTO Team (Name, Country) VALUES('Galatasaray ', 'Turkey');

-- positions on the field.
INSERT INTO Position(id, Code, Name) VALUES(100, '', 'Not on field');
INSERT INTO Position(id, Code, Name) VALUES(4, 'CB', 'Centre Back');
INSERT INTO Position(id, Code, Name) VALUES(11, 'CF', 'Centre Forward');
INSERT INTO Position(id, Code, Name) VALUES(7, 'CM', 'Center Midfielder');
INSERT INTO Position(id, Code, Name) VALUES(101, 'DF', 'Defender');
INSERT INTO Position(id, Code, Name) VALUES(103, 'FW', 'Forward');
INSERT INTO Position(id, Code, Name) VALUES(1, 'GK', 'Goalkeeper');
INSERT INTO Position(id, Code, Name) VALUES(5, 'LB', 'Left Back');
INSERT INTO Position(id, Code, Name) VALUES(8, 'LM', 'Left Midfielder');
INSERT INTO Position(id, Code, Name) VALUES(9, 'LW', 'Left Winger');
INSERT INTO Position(id, Code, Name) VALUES(102, 'MF', 'Midfielder');
INSERT INTO Position(id, Code, Name) VALUES(3, 'RB', 'Right Back');
INSERT INTO Position(id, Code, Name) VALUES(6, 'RM', 'Right Midfielder');
INSERT INTO Position(id, Code, Name) VALUES(10, 'RW', 'Right Winger');
INSERT INTO Position(id, Code, Name) VALUES(2, 'SW', 'Sweeper');

-- FIFA 100 Pele's list
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Gabriel Batistuta', 103, '1969-02-01', ' Argentina', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Hernán Crespo', 103, '1975-07-05', ' Argentina', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Alfredo di Stéfano', 103, '1926-07-04', ' Argentina', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Mario Kempes', 103, '1954-07-15', ' Argentina', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Diego Maradona', 103, '1960-10-30', ' Argentina', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Daniel Passarella', 101, '1953-05-25', ' Argentina', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Javier Saviola', 103, '1981-12-11', ' Argentina', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Omar Sivori', 103, '1935-10-02', ' Argentina', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Juan Sebastián Verón', 102, '1975-03-09', ' Argentina', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Javier Zanetti', 101, '1973-08-10', ' Argentina', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Jan Ceulemans', 102, '1957-02-28', ' Belgium', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Jean-Marie Pfaff', 1, '1953-12-04', ' Belgium', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Franky Van der Elst', 102, '1961-04-30', ' Belgium', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Carlos Alberto', 101, '1944-07-17', ' Brazil', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Cafu', 101, '1970-06-07', ' Brazil', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Falcão', 102, '1953-10-16', ' Brazil', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Pelé', 103, '1940-10-23', ' Brazil', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Júnior', 102, '1954-06-29', ' Brazil', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Rivaldo', 102, '1972-04-19', ' Brazil', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Rivelino', 102, '1946-01-01', ' Brazil', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Roberto Carlos', 101, '1973-04-10', ' Brazil', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Romário', 103, '1966-01-29', ' Brazil', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Ronaldinho', 102, '1980-03-21', ' Brazil', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Ronaldo', 103, '1976-09-18', ' Brazil', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Djalma Santos', 101, '1929-02-27', ' Brazil', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Nílton Santos', 101, '1925-05-16', ' Brazil', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Sócrates', 102, '1954-02-19', ' Brazil', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Zico', 102, '1953-03-03', ' Brazil', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Hristo Stoichkov', 103, '1966-02-08', ' Bulgaria', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Roger Milla', 103, '1952-05-20', ' Cameroon', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Elías Figueroa', 101, '1946-10-25', ' Chile', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Iván Zamorano', 103, '1967-01-18', ' Chile', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Carlos Valderrama', 102, '1961-09-02', ' Colombia', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Davor Šuker', 103, '1968-01-01', ' Croatia', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Josef Masopust', 102, '1931-02-09', ' Czech Republic', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Pavel Nedvěd', 102, '1972-08-30', ' Czech Republic', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Brian Laudrup', 103, '1969-02-22', ' Denmark', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Michael Laudrup', 102, '1964-06-15', ' Denmark', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Peter Schmeichel', 1, '1963-11-18', ' Denmark', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Gordon Banks', 1, '1937-12-30', ' England', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('David Beckham', 102, '1975-05-02', ' England', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Bobby Charlton', 102, '1937-10-11', ' England', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Kevin Keegan', 103, '1951-02-14', ' England', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Gary Lineker', 103, '1960-11-30', ' England', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Bobby Moore', 101, '1941-04-12', ' England', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Michael Owen', 103, '1979-12-14', ' England', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Alan Shearer', 103, '1970-08-13', ' England', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Éric Cantona', 103, '1966-05-24', ' France', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Marcel Desailly', 101, '1968-09-07', ' France', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Didier Deschamps', 102, '1968-10-15', ' France', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Just Fontaine', 103, '1933-08-18', ' France', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Thierry Henry', 103, '1977-08-17', ' France', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Raymond Kopa', 102, '1931-10-31', ' France', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Jean-Pierre Papin', 103, '1963-11-05', ' France', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Robert Pirès', 102, '1973-10-29', ' France', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Michel Platini', 102, '1955-06-21', ' France', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Lilian Thuram', 101, '1972-01-01', ' France', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Marius Trésor', 101, '1950-01-15', ' France', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('David Trezeguet', 103, '1977-10-15', ' France', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Patrick Vieira', 102, '1976-06-23', ' France', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Zinedine Zidane', 102, '1972-06-23', ' France', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Michael Ballack', 102, '1976-09-26', ' Germany', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Franz Beckenbauer', 2, '1945-09-11', ' Germany', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Paul Breitner', 102, '1951-09-05', ' Germany', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Oliver Kahn', 1, '1969-06-15', ' Germany', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Jürgen Klinsmann', 103, '1964-07-30', ' Germany', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Sepp Maier', 1, '1944-02-28', ' Germany', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Lothar Matthäus', 102, '1961-03-21', ' Germany', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Gerd Müller', 103, '1945-11-03', ' Germany', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Karl-Heinz Rummenigge', 103, '1955-09-25', ' Germany', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Uwe Seeler', 103, '1936-11-05', ' Germany', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Abédi Pelé', 103, '1964-11-05', ' Ghana', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Ferenc Puskás', 103, '1927-04-02', ' Hungary', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Roberto Baggio', 103, '1967-02-18', ' Italy', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Franco Baresi', 101, '1960-05-08', ' Italy', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Giuseppe Bergomi', 101, '1963-12-22', ' Italy', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Giampiero Boniperti', 103, '1928-07-04', ' Italy', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Gianluigi Buffon', 1, '1978-01-28', ' Italy', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Alessandro Del Piero', 103, '1974-11-09', ' Italy', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Giacinto Facchetti', 101, '1942-07-18', ' Italy', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Paolo Maldini', 101, '1968-06-26', ' Italy', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Alessandro Nesta', 101, '1976-03-19', ' Italy', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Gianni Rivera', 102, '1943-08-18', ' Italy', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Paolo Rossi', 103, '1956-09-23', ' Italy', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Francesco Totti', 103, '1976-09-27', ' Italy', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Christian Vieri', 103, '1973-07-12', ' Italy', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Dino Zoff', 1, '1942-02-28', '', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Hidetoshi Nakata', 102, '1977-01-22', ' Japan', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('George Weah', 103, '1966-10-01', ' Liberia', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Hugo Sánchez', 103, '1958-07-11', ' Mexico', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Marco van Basten', 103, '1964-10-31', ' Netherlands', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Dennis Bergkamp', 103, '1969-05-10', ' Netherlands', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Johan Cruyff', 103, '1947-04-25', ' Netherlands', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Edgar Davids', 102, '1973-03-13', ' Netherlands', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Ruud Gullit', 102, '1962-09-01', ' Netherlands', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('René van de Kerkhof', 102, '1951-09-16', ' Netherlands', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Willy van de Kerkhof', 102, '1951-09-16', ' Netherlands', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Patrick Kluivert', 103, '1976-07-01', ' Netherlands', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Johan Neeskens', 102, '1951-09-15', ' Netherlands', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Ruud van Nistelrooy', 103, '1976-07-01', ' Netherlands', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Rob Rensenbrink', 103, '1947-07-03', ' Netherlands', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Frank Rijkaard', 102, '1962-09-30', ' Netherlands', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Clarence Seedorf', 102, '1976-04-01', ' Netherlands', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Jay-Jay Okocha', 102, '1973-08-14', ' Nigeria', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('George Best', 102, '1946-05-22', ' Northern Ireland', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Romerito', 103, '1960-08-28', ' Paraguay', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Teófilo Cubillas', 103, '1949-03-08', ' Peru', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Zbigniew Boniek', 102, '1956-03-03', ' Poland', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Eusébio', 103, '1942-01-25', ' Portugal', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Luís Figo', 102, '1972-11-04', ' Portugal', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Rui Costa', 102, '1972-03-29', ' Portugal', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Roy Keane', 102, '1971-08-10', ' Republic of Ireland', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Gheorghe Hagi', 102, '1965-02-05', ' Romania', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Rinat Dasayev', 1, '1957-06-13', ' Russia', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Kenny Dalglish', 103, '1951-03-04', ' Scotland', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('El Hadji Diouf', 103, '1981-01-15', ' Senegal', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Hong Myung-Bo', 101, '1969-02-12', ' South Korea', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Emilio Butragueño', 103, '1963-07-22', ' Spain', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Luis Enrique', 102, '1970-05-08', ' Spain', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Raúl', 103, '1977-06-27', ' Spain', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Rüştü Reçber', 1, '1973-05-10', ' Turkey', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Emre Belözoğlu', 102, '1980-07-09', ' Turkey', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Andriy Shevchenko', 103, '1976-09-29', ' Ukraine', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Michelle Akers', 102, '1966-02-01', ' United States', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Mia Hamm', 103, '1972-03-17', ' United States', 1, 'Player');
INSERT INTO Player(Name, PreferredPosition_Id, DateOfBirth, Country, Team_Id, Role) VALUES('Enzo Francescoli', 103, '1961-11-12', ' Uruguay', 1, 'Player');

-- 10 top managers (coaches)
INSERT INTO Player (id, Name, Country, DateOfBirth, Team_Id, Role, PreferredPosition_Id) VALUES(1001, 'Ottmar Hitzfeld', 'Germany', null, 1, 'Coach', 100);
INSERT INTO Player (id, Name, Country, DateOfBirth, Team_Id, Role, PreferredPosition_Id) VALUES(1002, 'Jose Mourinho', 'Portugal', null, 2, 'Coach', 100);
INSERT INTO Player (id, Name, Country, DateOfBirth, Team_Id, Role, PreferredPosition_Id) VALUES(1003, 'Matt Busby', 'Scotland', null, 3, 'Coach', 100);
INSERT INTO Player (id, Name, Country, DateOfBirth, Team_Id, Role, PreferredPosition_Id) VALUES(1004, 'Brian Clough', 'England', null, 4, 'Coach', 100);
INSERT INTO Player (id, Name, Country, DateOfBirth, Team_Id, Role, PreferredPosition_Id) VALUES(1005, 'Helenio Herrera', 'Argentina', null, 5, 'Coach', 100);
INSERT INTO Player (id, Name, Country, DateOfBirth, Team_Id, Role, PreferredPosition_Id) VALUES(1006, 'Bob Paisley', 'England', null, 6, 'Coach', 100);
INSERT INTO Player (id, Name, Country, DateOfBirth, Team_Id, Role, PreferredPosition_Id) VALUES(1007, 'Ernst Happel', 'Austria', null, 7, 'Coach', 100);
INSERT INTO Player (id, Name, Country, DateOfBirth, Team_Id, Role, PreferredPosition_Id) VALUES(1008, 'Jock Stein', 'Scotland', null, 8, 'Coach', 100);
INSERT INTO Player (id, Name, Country, DateOfBirth, Team_Id, Role, PreferredPosition_Id) VALUES(1009, 'Rinus Michels', 'Netherlands', null, 9, 'Coach', 100);
INSERT INTO Player (id, Name, Country, DateOfBirth, Team_Id, Role, PreferredPosition_Id) VALUES(1010, 'Alex Ferguson', 'England', null, 10, 'Coach', 100);


