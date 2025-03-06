import React, { useEffect, useState } from 'react';
import { 
  Box, Heading, Text, Button, Flex, SimpleGrid, 
  Stat, StatLabel, StatNumber, StatHelpText, 
  useDisclosure, Modal, ModalOverlay, ModalContent, 
  ModalHeader, ModalBody, ModalCloseButton, FormControl, 
  FormLabel, Input, NumberInput, NumberInputField, 
  NumberInputStepper, NumberIncrementStepper, NumberDecrementStepper, 
  ModalFooter, Spinner, useToast, Center, HStack
} from '@chakra-ui/react';
import { useApi } from '../context/ApiContext';
import { useAuth } from '../context/AuthContext';

const League = () => {
  const { getLeague, generateSchedule, joinLeague, loading, error } = useApi();
  const { user } = useAuth();
  const [league, setLeague] = useState(null);
  const [userIsMember, setUserIsMember] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [weeksPerSeason, setWeeksPerSeason] = useState(9);
  const toast = useToast();
  
  useEffect(() => {
    fetchLeague();
  }, []);
  
  useEffect(() => {
    if (league && user) {
      // Check if user is a member of the league
      const isMember = league.members?.some(member => member._id === user._id || member === user._id);
      setUserIsMember(isMember);
    }
  }, [league, user]);
  
  const fetchLeague = async () => {
    try {
      const data = await getLeague();
      setLeague(data);
    } catch (error) {
      console.error('Error fetching league:', error);
    }
  };
  
  const handleGenerateSchedule = async () => {
    try {
      await generateSchedule(weeksPerSeason);
      
      toast({
        title: 'Schedule Generated',
        description: `A ${weeksPerSeason}-week schedule has been generated`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Refresh league data
      fetchLeague();
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate schedule',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  const handleJoinLeague = async () => {
    try {
      await joinLeague(league._id);
      
      toast({
        title: 'League Joined',
        description: `You have successfully joined ${league.name}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Refresh league data
      fetchLeague();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to join league',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };
  
  if (loading && !league) {
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
        <Heading size="md" color="red.400" mb={2}>Error Loading League</Heading>
        <Text color="gray.300">{error}</Text>
      </Box>
    );
  }
  
  if (!league) {
    return (
      <Box p={6} bg="gray.800" rounded="md" textAlign="center" borderWidth={1} borderColor="gray.700">
        <Heading size="md" color="gray.400" mb={4}>League Not Found</Heading>
        <Text color="gray.500">A league needs to be created on the backend first</Text>
      </Box>
    );
  }
  
  return (
    <Box>
      <Flex justify="space-between" align="center" mb={6}>
        <Heading color="white">{league.name}</Heading>
        <HStack spacing={3}>
          <Button 
            colorScheme="yellow" 
            onClick={handleJoinLeague}
            isLoading={loading}
          >
            Join League
          </Button>
          <Button 
            colorScheme="yellow" 
            onClick={onOpen}
            isLoading={loading}
          >
            Generate New Schedule
          </Button>
        </HStack>
      </Flex>
      
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6} mb={10}>
        <Stat bg="gray.800" p={6} rounded="md" shadow="md" borderWidth={1} borderColor="gray.700">
          <StatLabel color="gray.400">Current Week</StatLabel>
          <StatNumber color="white">{league.currentWeek || 0}</StatNumber>
          <StatHelpText color="gray.400">of {league.schedule?.length || 0} weeks</StatHelpText>
        </Stat>
        
        <Stat bg="gray.800" p={6} rounded="md" shadow="md" borderWidth={1} borderColor="gray.700">
          <StatLabel color="gray.400">Teams</StatLabel>
          <StatNumber color="white">{league.teams?.length || 0}</StatNumber>
          <StatHelpText color="gray.400">Maximum: {league.maxTeams || 0}</StatHelpText>
        </Stat>
        
        <Stat bg="gray.800" p={6} rounded="md" shadow="md" borderWidth={1} borderColor="gray.700">
          <StatLabel color="gray.400">Players</StatLabel>
          <StatNumber color="white">{league.playerPool?.length || 0}</StatNumber>
          <StatHelpText color="gray.400">Available for drafting</StatHelpText>
        </Stat>
      </SimpleGrid>
      
      <Box bg="gray.800" p={6} rounded="md" shadow="md" borderWidth={1} borderColor="gray.700">
        <Heading size="md" mb={4} color="white">League Info</Heading>
        
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8}>
          <Box>
            <Text fontWeight="bold" mb={2} color="yellow.300">Schedule</Text>
            <Text color="gray.300">
              {league.schedule?.length ? (
                `${league.schedule.length} week season with ${league.schedule.flat().length} total matchups`
              ) : (
                'No schedule generated yet'
              )}
            </Text>
          </Box>
          
          <Box>
            <Text fontWeight="bold" mb={2} color="yellow.300">Team Distribution</Text>
            {league.teams?.length > 0 ? (
              <Text color="gray.300">
                {league.teams.length} teams in the league
              </Text>
            ) : (
              <Text color="gray.500">No teams in the league yet</Text>
            )}
          </Box>
        </SimpleGrid>
      </Box>
      
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay backdropFilter="blur(10px)" />
        <ModalContent bg="gray.800" borderWidth={1} borderColor="gray.700">
          <ModalHeader color="white">Generate New Schedule</ModalHeader>
          <ModalCloseButton color="white" />
          <ModalBody>
            <Text mb={4} color="gray.300">
              This will create a new schedule for the league. All current matchups and results will be reset.
            </Text>
            
            <FormControl>
              <FormLabel color="gray.300">Weeks Per Season</FormLabel>
              <NumberInput 
                value={weeksPerSeason} 
                min={1} 
                max={20}
                onChange={(_, value) => setWeeksPerSeason(value)}
              >
                <NumberInputField 
                  bg="gray.700" 
                  color="white" 
                  borderColor="gray.600"
                  _hover={{ borderColor: "yellow.300" }}
                  _focus={{ borderColor: "yellow.300" }}
                />
                <NumberInputStepper>
                  <NumberIncrementStepper color="yellow.300" borderColor="gray.600" />
                  <NumberDecrementStepper color="yellow.300" borderColor="gray.600" />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>
          </ModalBody>
          
          <ModalFooter borderTopWidth="1px" borderColor="gray.700">
            <Button variant="ghost" mr={3} onClick={onClose} color="gray.300" _hover={{ bg: "whiteAlpha.100" }}>
              Cancel
            </Button>
            <Button 
              colorScheme="yellow" 
              onClick={handleGenerateSchedule}
              isLoading={loading}
            >
              Generate Schedule
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default League;