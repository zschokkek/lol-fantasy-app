import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { 
  Box, Heading, SimpleGrid, Text, Button, Flex, 
  Link, Badge, Spinner, Icon, Center, IconButton
} from '@chakra-ui/react';
import { InfoIcon, ChevronLeftIcon } from '@chakra-ui/icons';
import { useApi } from '../context/ApiContext';
import { useAuth } from '../context/AuthContext';

const TeamCard = ({ team }) => {
  return (
    <Box 
      as={RouterLink}
      to={`/teams/${team.id}`}
      display="block"
      textDecoration="none"
      _hover={{ textDecoration: "none" }}
    >
      <Box 
        bg="gray.800" 
        p={6} 
        rounded="lg" 
        shadow="xl" 
        borderWidth={1}
        borderColor="gray.700"
        transition="all 0.3s"
        _hover={{ shadow: '2xl', transform: 'translateY(-4px)', borderColor: 'yellow.400' }}
        position="relative"
        overflow="hidden"
      >
      {/* Top accent bar */}
      <Box position="absolute" top={0} left={0} right={0} height="4px" bg="yellow.400" />
      
      <Heading size="md" mb={2} fontWeight="bold" color="white">
        {team.name}
      </Heading>
      
      <Text color="gray.400" fontSize="sm" mb={4}>
        League: {team.leagueName ? (
          <Link as={RouterLink} to={`/leagues/${team.leagueId}`} color="yellow.300" _hover={{ textDecoration: 'underline' }}>
            {team.leagueName}
          </Link>
        ) : 'Not assigned'}
      </Text>
      
      <Flex direction="column" gap={3}>
        {['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT', 'FLEX'].map(position => (
          <Flex 
            key={position} 
            justify="space-between" 
            align="center" 
            p={2} 
            bg="gray.700" 
            rounded="md"
            borderWidth="1px"
            borderColor="gray.600"
          >
            <Badge 
              width="80px" 
              py={1} 
              textAlign="center"
              colorScheme={
                position === 'TOP' ? 'red' :
                position === 'JUNGLE' ? 'green' :
                position === 'MID' ? 'purple' :
                position === 'ADC' ? 'orange' :
                position === 'SUPPORT' ? 'blue' :
                'gray'
              }
              fontWeight="bold"
            >
              {position}
            </Badge>
            <Text 
              flex="1" 
              ml={3} 
              fontWeight={team.players[position] ? 'medium' : 'normal'} 
              color={team.players[position] ? 'white' : 'gray.400'}
              isTruncated
            >
              {team.players[position]?.name || 'Empty'}
            </Text>
          </Flex>
        ))}
      </Flex>
      
      <Flex justify="space-between" mt={4} pt={4} borderTopWidth={1} borderColor="gray.600">
        <Text fontSize="sm" color="gray.400">
          Bench Players: {team.players.BENCH?.length || 0}
        </Text>
        <Text fontWeight="bold" color="yellow.300" fontSize="lg">
          {team.totalPoints.toFixed(1)} pts
        </Text>
      </Flex>
      </Box>
    </Box>
  );
};

const Teams = () => {
  const { getMyTeams, loading, error } = useApi();
  const [teams, setTeams] = useState([]);
  const navigate = useNavigate();
  
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const data = await getMyTeams();
        setTeams(data);
      } catch (error) {
        console.error('Error fetching teams:', error);
      }
    };
    
    fetchTeams();
  }, [getMyTeams]);
  
  // Handle back button click
  const handleBack = () => {
    navigate('/leagues');
  };
  
  if (loading && teams.length === 0) {
    return (
      <Center h="200px">
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
  
  if (error) {
    return (
      <Box p={6} bg="gray.800" rounded="md" borderWidth={1} borderColor="red.500">
        <Heading size="md" color="red.400" mb={2}>Error Loading Teams</Heading>
        <Text color="gray.300">{error}</Text>
      </Box>
    );
  }
  
  return (
    <Box>
      <Flex mb={4} align="center">
        <IconButton
          icon={<ChevronLeftIcon boxSize={6} />}
          aria-label="Back to leagues"
          variant="ghost"
          colorScheme="yellow"
          size="lg"
          onClick={handleBack}
          mr={2}
          _hover={{ bg: 'yellow.500', color: 'white' }}
        />
        <Text color="gray.400" fontSize="md">Back to Leagues</Text>
      </Flex>
      
      <Flex justify="space-between" align="center" mb={6}>
        <Heading color="white">My Teams</Heading>
      </Flex>
      
      {teams.length > 0 ? (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {teams.map(team => (
            <TeamCard key={team.id} team={team} />
          ))}
        </SimpleGrid>
      ) : (
        <Box p={8} bg="gray.800" rounded="lg" textAlign="center" borderWidth={1} borderColor="gray.700">
          <Icon as={InfoIcon} boxSize={12} color="gray.400" mb={4} />
          <Heading size="md" mb={2} fontWeight="bold" color="white">No Teams Found</Heading>
          <Text color="gray.400" mb={6}>
            You don't have any teams yet. To create a team:
          </Text>
          <Box bg="gray.700" p={4} rounded="md" textAlign="left" mb={4}>
            <Text color="white" fontWeight="bold" mb={2}>How to create a team:</Text>
            <Text color="gray.300">1. Go to the Leagues section</Text>
            <Text color="gray.300">2. Join an existing league or create a new one</Text>
            <Text color="gray.300">3. Create your team within that league</Text>
          </Box>
          <Button
            as={RouterLink}
            to="/leagues"
            colorScheme="yellow"
            size="lg"
          >
            Browse Leagues
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default Teams;