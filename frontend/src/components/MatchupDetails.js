import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { 
  Box, Heading, Flex, Text, Image, Badge, 
  Link, Grid, GridItem, VStack, HStack, 
  Stat, StatLabel, StatNumber, StatHelpText, useBreakpointValue,
  Spinner, Center
} from '@chakra-ui/react';
import { useApi } from '../context/ApiContext';

const PlayerCard = ({ player, position }) => {
  if (!player) return (
    <Box 
      p={3} 
      bg="gray.800" 
      borderWidth={1} 
      borderColor="gray.700" 
      borderRadius="md"
      opacity={0.6}
    >
      <Text color="gray.400" fontStyle="italic">Empty {position}</Text>
    </Box>
  );
  
  return (
    <Box 
      p={3} 
      bg="gray.800" 
      borderWidth={1} 
      borderColor="gray.700" 
      borderRadius="md"
      transition="transform 0.2s"
      _hover={{ transform: 'translateY(-2px)', borderColor: "yellow.400" }}
    >
      <Flex justify="space-between" align="center">
        <Link 
          as={RouterLink} 
          to={`/players/${player.id}`} 
          fontWeight="bold"
          color="white"
        >
          {player.name}
        </Link>
        <Badge 
          py={1} 
          px={2}
          colorScheme={
            position === 'TOP' ? 'red' :
            position === 'JUNGLE' ? 'green' :
            position === 'MID' ? 'purple' :
            position === 'ADC' ? 'orange' :
            position === 'SUPPORT' ? 'blue' :
            'gray'
          }
        >
          {position}
        </Badge>
      </Flex>
      <Flex mt={2} justify="space-between">
        <Text color="gray.400" fontSize="sm">{player.team}</Text>
        <Text color="yellow.300" fontWeight="bold">{player.points?.toFixed(1) || 0}</Text>
      </Flex>
    </Box>
  );
};

const TeamColumn = ({ team, isLeft, isLoading }) => {
  const playerPositions = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'FLEX'];
  
  if (isLoading) {
    return (
      <VStack spacing={4} align={isLeft ? "flex-end" : "flex-start"} width="100%">
        <Box 
          p={5} 
          bg="gray.800" 
          borderRadius="md" 
          borderWidth={1}
          borderColor="gray.700"
          width="100%"
          textAlign={isLeft ? "right" : "left"}
          height="120px"
          display="flex"
          alignItems="center"
          justifyContent={isLeft ? "flex-end" : "flex-start"}
        >
          <Spinner 
            thickness="4px"
            speed="0.65s"
            emptyColor="gray.700"
            color="yellow.400"
            size="md"
          />
        </Box>
      </VStack>
    );
  }

  return (
    <VStack spacing={4} align={isLeft ? "flex-end" : "flex-start"} width="100%">
      <Box 
        p={5} 
        bg="gray.800" 
        borderRadius="md" 
        borderWidth={1}
        borderColor="gray.700"
        width="100%"
        textAlign={isLeft ? "right" : "left"}
        bgGradient={
          isLeft 
            ? "linear(to-l, yellow.400, transparent)" 
            : "linear(to-r, yellow.400, transparent)"
        }
        opacity={0.8}
      >
        <Link 
          as={RouterLink} 
          to={`/teams/${team.id}`} 
          _hover={{ textDecoration: "none" }}
        >
          <Heading size="md" color="white">
            {team?.name || 'Team'}
          </Heading>
        </Link>
        <Text color="gray.300" fontSize="sm">
          Owner: {team?.owner || 'Unknown'}
        </Text>
        <Stat mt={2}>
          <StatLabel color="gray.400">Total Points</StatLabel>
          <StatNumber color="yellow.300">{team?.totalPoints?.toFixed(1) || '0.0'}</StatNumber>
        </Stat>
      </Box>
      
      <VStack spacing={3} width="100%" align={isLeft ? "flex-end" : "flex-start"}>
        {playerPositions.map(position => (
          <Box key={position} width="100%">
            <PlayerCard 
              player={team?.players?.[position]} 
              position={position} 
            />
          </Box>
        ))}
      </VStack>
    </VStack>
  );
};

const MatchupDetails = ({ matchup }) => {
  const { getTeamById, loading } = useApi();
  const [homeTeam, setHomeTeam] = useState(null);
  const [awayTeam, setAwayTeam] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const mapSize = useBreakpointValue({ base: "200px", md: "300px", lg: "400px" });
  
  useEffect(() => {
    const fetchTeamDetails = async () => {
      if (!matchup) return;
      
      setIsLoading(true);
      
      try {
        // If teams are already fully populated with players, use those
        if (matchup.homeTeam?.players) {
          setHomeTeam(matchup.homeTeam);
        } else if (matchup.homeTeamId) {
          // Otherwise fetch the full team data
          const homeTeamData = await getTeamById(matchup.homeTeamId || matchup.homeTeam?.id);
          setHomeTeam(homeTeamData);
        } else {
          setHomeTeam(matchup.homeTeam || {});
        }
        
        if (matchup.awayTeam?.players) {
          setAwayTeam(matchup.awayTeam);
        } else if (matchup.awayTeamId) {
          const awayTeamData = await getTeamById(matchup.awayTeamId || matchup.awayTeam?.id);
          setAwayTeam(awayTeamData);
        } else {
          setAwayTeam(matchup.awayTeam || {});
        }
      } catch (error) {
        console.error('Error fetching team details:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTeamDetails();
  }, [matchup, getTeamById]);
  
  if (!matchup) {
    return (
      <Box p={6} bg="gray.800" rounded="md" borderWidth={1} borderColor="gray.700">
        <Heading size="md" color="gray.400">Matchup Not Found</Heading>
      </Box>
    );
  }
  
  if (loading && isLoading) {
    return (
      <Center h="300px">
        <Spinner 
          thickness="4px"
          speed="0.65s"
          emptyColor="gray.700"
          color="yellow.400"
          size="xl"
        />
      </Center>
    );
  }
  
  return (
    <Box>
      <Flex 
        justify="space-between" 
        align="center" 
        mb={6}
        bgGradient="linear(to-r, yellow.400, orange.300)"
        p={4}
        borderRadius="md"
      >
        <Box>
          <Heading color="gray.800">Week {matchup.week} Matchup</Heading>
        </Box>
        <HStack spacing={4}>
          {matchup.completed && (
            <Badge 
              py={1} 
              px={3} 
              colorScheme="yellow"
              fontSize="md"
            >
              Completed
            </Badge>
          )}
          <Text fontWeight="bold" fontSize="lg">
            Match {matchup.id.split('_').pop()}
          </Text>
        </HStack>
      </Flex>
      
      <Grid
        templateColumns={{ base: "1fr", lg: "1fr auto 1fr" }}
        gap={{ base: 8, lg: 4 }}
      >
        {/* Home Team - Left Column in desktop, top in mobile */}
        <GridItem>
          <TeamColumn 
            team={homeTeam} 
            isLeft={true} 
            isLoading={isLoading}
          />
        </GridItem>
        
        {/* Center Map Image */}
        <GridItem 
          display="flex" 
          justifyContent="center" 
          alignItems="center"
          position="relative"
        >
          <Box 
            position="relative" 
            width={mapSize} 
            height={mapSize}
            display="flex"
            justifyContent="center"
            alignItems="center"
          >
            <Image 
              src="/images/favicon_io/map.jpg" 
              alt="League of Legends Map" 
              objectFit="cover"
              borderRadius="full"
              border="3px solid"
              borderColor="yellow.400"
            />
            
            {/* Score Display */}
            <Flex
              position="absolute"
              top="50%"
              left="50%"
              transform="translate(-50%, -50%)"
              bg="rgba(0,0,0,0.7)"
              p={3}
              borderRadius="md"
              borderWidth={2}
              borderColor="yellow.400"
              direction="column"
              align="center"
              width="80%"
            >
              <Text 
                fontSize="3xl" 
                fontWeight="bold" 
                color="white"
              >
                {(matchup.homeScore ?? 0).toFixed(1)} : {(matchup.awayScore ?? 0).toFixed(1)}
              </Text>
              
              {matchup.completed && (
                <Badge 
                  mt={2} 
                  px={3} 
                  py={1} 
                  colorScheme="yellow"
                  borderRadius="full"
                >
                  {(matchup.homeScore ?? 0) > (matchup.awayScore ?? 0)
                    ? `${homeTeam?.name || 'Home Team'} Wins`
                    : `${awayTeam?.name || 'Away Team'} Wins`
                  }
                </Badge>
              )}
            </Flex>
          </Box>
        </GridItem>
        
        {/* Away Team - Right Column in desktop, bottom in mobile */}
        <GridItem>
          <TeamColumn 
            team={awayTeam} 
            isLeft={false} 
            isLoading={isLoading}
          />
        </GridItem>
      </Grid>
    </Box>
  );
};

export default MatchupDetails;
