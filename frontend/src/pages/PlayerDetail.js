import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Box, Heading, Text, Stat, StatLabel, StatNumber, StatHelpText,
  SimpleGrid, Badge, Button, Flex, Divider, Progress,
  Spinner, useToast, Center, Avatar, Image, IconButton
} from '@chakra-ui/react';
import { ChevronLeftIcon } from '@chakra-ui/icons';
import { useApi } from '../context/ApiContext';

const PlayerDetail = () => {
  const { id } = useParams();
  const { getPlayerById, getPlayerImage, loading, error } = useApi();
  const [player, setPlayer] = useState(null);
  const [playerImage, setPlayerImage] = useState(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract the referring league ID from the location state or search params
  const getReferringLeagueId = () => {
    // First check if it was passed in location state
    if (location.state && location.state.fromLeagueId) {
      return location.state.fromLeagueId;
    }
    
    // Then check URL search params
    const searchParams = new URLSearchParams(location.search);
    const leagueId = searchParams.get('leagueId');
    if (leagueId) {
      return leagueId;
    }
    
    // Default to leagues page if no referring league
    return null;
  };
  
  const handleBack = () => {
    const leagueId = getReferringLeagueId();
    if (leagueId) {
      navigate(`/${leagueId}/players`);
    } else {
      // If no referring league, go to leagues list
      navigate('/leagues');
    }
  };
  
  useEffect(() => {
    const fetchPlayer = async () => {
      try {
        const data = await getPlayerById(id);
        setPlayer(data);
      } catch (error) {
        console.error('Error fetching player:', error);
      }
    };
    
    fetchPlayer();
  }, [getPlayerById, id]);
  
  useEffect(() => {
    const fetchPlayerImage = async () => {
      if (!id) return;
      
      setIsLoadingImage(true);
      try {
        const imageData = await getPlayerImage(id);
        setPlayerImage(imageData);
      } catch (error) {
        console.error('Error fetching player image:', error);
        // If there's an error fetching the image, we'll use the fallback in the component
      } finally {
        setIsLoadingImage(false);
      }
    };
    
    fetchPlayerImage();
  }, [getPlayerImage, id]);
  
  if (loading && !player) {
    return (
      <Center h="200px">
        <Spinner 
          thickness="4px"
          speed="0.65s"
          emptyColor="gray.700"
          color="teal.400"
          size="xl"
        />
      </Center>
    );
  }
  
  if (error) {
    return (
      <Box p={6} bg="gray.800" rounded="md" borderWidth={1} borderColor="red.500">
        <Heading size="md" color="red.400" mb={2}>Error Loading Player</Heading>
        <Text color="gray.300">{error}</Text>
      </Box>
    );
  }
  
  if (!player) {
    return (
      <Box p={6} bg="gray.800" rounded="md" borderWidth={1} borderColor="gray.700">
        <Heading size="md" color="gray.400">Player Not Found</Heading>
      </Box>
    );
  }
  
  return (
    <Box>
      <Flex mb={4} align="center">
        <IconButton
          icon={<ChevronLeftIcon boxSize={6} />}
          aria-label="Back to league"
          variant="ghost"
          colorScheme="yellow"
          size="lg"
          onClick={handleBack}
          mr={2}
          _hover={{ bg: 'yellow.500', color: 'white' }}
        />
        <Text color="gray.400" fontSize="md">Back to League</Text>
      </Flex>
      
      <Flex justify="space-between" align="center" mb={6}>
        <Box maxW="60%">
          <Heading color="white" size="2xl" fontSize="48px" letterSpacing="-1px">{player.name}</Heading>
          <Flex gap={2} mt={3} align="center">
            <Badge 
              colorScheme={
                player.position === 'TOP' ? 'red' :
                player.position === 'JUNGLE' ? 'green' :
                player.position === 'MID' ? 'purple' :
                player.position === 'ADC' ? 'orange' :
                'blue'
              } 
              fontSize="md" 
              px={3} 
              py={1}
            >
              {player.position}
            </Badge>
            <Badge colorScheme="yellow" fontSize="md" px={3} py={1}>
              {player.region}
            </Badge>
            <Text fontWeight="medium" color="gray.300" fontSize="lg">{player.team}</Text>
          </Flex>
        </Box>
        
        {isLoadingImage ? (
          <Center w="420px" h="420px" bg="gray.700" borderRadius="xl" mr={16}>
            <Spinner size="xl" color="yellow.400" />
          </Center>
        ) : (
          <Box 
            position="relative" 
            borderRadius="xl" 
            overflow="hidden"
            w="420px"
            h="420px"
            mr={16}
          >
            <Image
              src={playerImage?.imageUrl || player.imageUrl}
              alt={player.name}
              objectFit="cover"
              w="100%"
              h="100%"
              fallback={
                <Avatar 
                  size="2xl" 
                  name={player.name} 
                  bg="gray.700"
                  w="100%"
                  h="100%"
                  fontSize="9xl"
                />
              }
            />
          </Box>
        )}
      </Flex>
      
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={8}>
        <Stat bg="gray.800" p={4} rounded="md" shadow="lg" borderWidth={1} borderColor="gray.700">
          <StatLabel color="gray.400">Fantasy Points</StatLabel>
          <StatNumber color="teal.300">{player.fantasyPoints.toFixed(1)}</StatNumber>
          <StatHelpText color="gray.400">
            {player.stats.gamesPlayed > 0
              ? `${(player.fantasyPoints / player.stats.gamesPlayed).toFixed(1)} per game`
              : 'No games played'}
          </StatHelpText>
        </Stat>
        
        <Stat bg="gray.800" p={4} rounded="md" shadow="lg" borderWidth={1} borderColor="gray.700">
          <StatLabel color="gray.400">KDA Ratio</StatLabel>
          <StatNumber color="teal.300">
            {player.stats.deaths > 0
              ? ((player.stats.kills + player.stats.assists) / player.stats.deaths).toFixed(2)
              : 'Perfect'}
          </StatNumber>
          <StatHelpText color="gray.400">
            {player.stats.kills} / {player.stats.deaths} / {player.stats.assists}
          </StatHelpText>
        </Stat>
        
        <Stat bg="gray.800" p={4} rounded="md" shadow="lg" borderWidth={1} borderColor="gray.700">
          <StatLabel color="gray.400">Games Played</StatLabel>
          <StatNumber color="teal.300">{player.stats.gamesPlayed}</StatNumber>
          <StatHelpText color="gray.400">
            CS/Game: {
                player.stats.gamesPlayed > 0 
                ? Math.round(player.stats.cs / player.stats.gamesPlayed) 
                : 0}
            </StatHelpText>
          </Stat>
        </SimpleGrid>
        
        <Box bg="gray.800" p={6} rounded="md" shadow="lg" mb={8} borderWidth={1} borderColor="gray.700">
          <Heading size="md" mb={4} color="white">Performance Stats</Heading>
          
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8}>
            <Box>
              <Text mb={1} color="gray.300">Kills Per Game</Text>
              <Flex align="center" mb={4}>
                <Progress 
                  value={player.stats.gamesPlayed > 0 
                    ? (player.stats.kills / player.stats.gamesPlayed) * 20 
                    : 0
                  } 
                  colorScheme="green" 
                  size="sm" 
                  rounded="md" 
                  flex="1" 
                  mr={4}
                  bg="gray.700"
                />
                <Text fontWeight="bold" color="white">
                  {player.stats.gamesPlayed > 0 
                    ? (player.stats.kills / player.stats.gamesPlayed).toFixed(1) 
                    : '0.0'}
                </Text>
              </Flex>
              
              <Text mb={1} color="gray.300">Deaths Per Game</Text>
              <Flex align="center" mb={4}>
                <Progress 
                  value={player.stats.gamesPlayed > 0 
                    ? (player.stats.deaths / player.stats.gamesPlayed) * 20 
                    : 0
                  } 
                  colorScheme="red" 
                  size="sm" 
                  rounded="md" 
                  flex="1" 
                  mr={4}
                  bg="gray.700"
                />
                <Text fontWeight="bold" color="white">
                  {player.stats.gamesPlayed > 0 
                    ? (player.stats.deaths / player.stats.gamesPlayed).toFixed(1) 
                    : '0.0'}
                </Text>
              </Flex>
              
              <Text mb={1} color="gray.300">Assists Per Game</Text>
              <Flex align="center">
                <Progress 
                  value={player.stats.gamesPlayed > 0 
                    ? (player.stats.assists / player.stats.gamesPlayed) * 10 
                    : 0
                  } 
                  colorScheme="blue" 
                  size="sm" 
                  rounded="md" 
                  flex="1" 
                  mr={4}
                  bg="gray.700"
                />
                <Text fontWeight="bold" color="white">
                  {player.stats.gamesPlayed > 0 
                    ? (player.stats.assists / player.stats.gamesPlayed).toFixed(1) 
                    : '0.0'}
                </Text>
              </Flex>
            </Box>
            
            <Box>
              <Text mb={1} color="gray.300">CS Per Game</Text>
              <Flex align="center" mb={4}>
                <Progress 
                  value={player.stats.gamesPlayed > 0 
                    ? (player.stats.cs / player.stats.gamesPlayed) / 4 
                    : 0
                  } 
                  colorScheme="orange" 
                  size="sm" 
                  rounded="md" 
                  flex="1" 
                  mr={4}
                  bg="gray.700"
                />
                <Text fontWeight="bold" color="white">
                  {player.stats.gamesPlayed > 0 
                    ? Math.round(player.stats.cs / player.stats.gamesPlayed) 
                    : '0'}
                </Text>
              </Flex>
              
              <Text mb={1} color="gray.300">Vision Score Per Game</Text>
              <Flex align="center" mb={4}>
                <Progress 
                  value={player.stats.gamesPlayed > 0 
                    ? (player.stats.visionScore / player.stats.gamesPlayed) * 2 
                    : 0
                  } 
                  colorScheme="purple" 
                  size="sm" 
                  rounded="md" 
                  flex="1" 
                  mr={4}
                  bg="gray.700"
                />
                <Text fontWeight="bold" color="white">
                  {player.stats.gamesPlayed > 0 
                    ? (player.stats.visionScore / player.stats.gamesPlayed).toFixed(1) 
                    : '0.0'}
                </Text>
              </Flex>
              
              <Text mb={1} color="gray.300">Objective Kills Per Game</Text>
              <Flex align="center">
                <Progress 
                  value={player.stats.gamesPlayed > 0 
                    ? ((player.stats.baronKills + player.stats.dragonKills + player.stats.turretKills) / player.stats.gamesPlayed) * 20 
                    : 0
                  } 
                  colorScheme="yellow" 
                  size="sm" 
                  rounded="md" 
                  flex="1" 
                  mr={4}
                  bg="gray.700"
                />
                <Text fontWeight="bold" color="white">
                  {player.stats.gamesPlayed > 0 
                    ? ((player.stats.baronKills + player.stats.dragonKills + player.stats.turretKills) / player.stats.gamesPlayed).toFixed(1) 
                    : '0.0'}
                </Text>
              </Flex>
            </Box>
          </SimpleGrid>
          
          <Divider my={6} borderColor="gray.600" />
          
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
            <Stat>
              <StatLabel color="gray.400">Total Kills</StatLabel>
              <StatNumber color="green.400">{player.stats.kills}</StatNumber>
            </Stat>
            
            <Stat>
              <StatLabel color="gray.400">Total Deaths</StatLabel>
              <StatNumber color="red.400">{player.stats.deaths}</StatNumber>
            </Stat>
            
            <Stat>
              <StatLabel color="gray.400">Total Assists</StatLabel>
              <StatNumber color="blue.400">{player.stats.assists}</StatNumber>
            </Stat>
            
            <Stat>
              <StatLabel color="gray.400">Total CS</StatLabel>
              <StatNumber color="orange.400">{player.stats.cs}</StatNumber>
            </Stat>
          </SimpleGrid>
        </Box>
      </Box>
    );
  };
  
  export default PlayerDetail;