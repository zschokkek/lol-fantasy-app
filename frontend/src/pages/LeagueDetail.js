import React, { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box, Heading, Text, Button, Flex, SimpleGrid, Link,
  Divider, Tabs, TabList, Tab, TabPanels, TabPanel,
  Badge, Spinner, useDisclosure, Modal, ModalOverlay,
  ModalContent, ModalHeader, ModalBody, ModalCloseButton,
  FormControl, FormLabel, Input, useToast, ModalFooter,
  HStack, VStack, Icon, Table, Thead, Tbody, Tr, Th, Td,
  Avatar, Grid, GridItem
} from '@chakra-ui/react';
import { 
  AddIcon, StarIcon, CheckIcon, CalendarIcon, 
  TimeIcon, InfoIcon, WarningIcon
} from '@chakra-ui/icons';
import { useApi } from '../context/ApiContext';
import { useAuth } from '../context/AuthContext';
import { useLeague } from '../context/LeagueContext';

const TeamCard = ({ team }) => {
  return (
    <Box
      bg="gray.800"
      p={5}
      rounded="lg"
      shadow="lg"
      borderWidth={1}
      borderColor="gray.700"
      transition="all 0.2s"
      _hover={{ shadow: 'xl', transform: 'translateY(-2px)', borderColor: 'teal.500' }}
      position="relative"
      overflow="hidden"
    >
      {/* Top accent line */}
      <Box position="absolute" top={0} left={0} right={0} height="3px" bg="teal.500" />
      
      <Flex justify="space-between" align="flex-start">
        <Heading size="md" mb={2} fontWeight="bold">
          <Link as={RouterLink} to={`/teams/${team.id}`} color="white" _hover={{ color: 'teal.300' }}>
            {team.name}
          </Link>
        </Heading>
        <Badge colorScheme="teal" fontSize="xs" px={2} py={1} rounded="full">
          {team.players ? Object.values(team.players).filter(p => p !== null && !Array.isArray(p)).length : 0} Players
        </Badge>
      </Flex>
      
      <Text color="gray.400" fontSize="sm" mb={3}>
        Owner: {team.owner}
      </Text>
      
      <Divider borderColor="gray.700" my={3} />
      
      <Flex justify="space-between" align="center">
        <Text fontSize="sm" color="gray.500">Fantasy Points</Text>
        <Text fontWeight="bold" fontSize="xl" color="teal.300">
          {team.totalPoints?.toFixed(1) || 0}
        </Text>
      </Flex>
    </Box>
  );
};

const MemberList = ({ members }) => {
  return (
    <Box bg="gray.800" p={5} rounded="lg" borderWidth="1px" borderColor="gray.700">
      <Heading size="md" mb={4}>League Members</Heading>
      <VStack spacing={3} align="stretch">
        {members.map((member, index) => (
          <Flex key={index} justify="space-between" align="center">
            <Flex align="center">
              <Avatar size="sm" name={member.username} mr={3} bg="teal.500" />
              <Text fontWeight="medium">{member.username}</Text>
            </Flex>
            <Badge colorScheme={index === 0 ? "purple" : "gray"}>
              {index === 0 ? "Creator" : "Member"}
            </Badge>
          </Flex>
        ))}
      </VStack>
    </Box>
  );
};

const CreateTeamModal = ({ isOpen, onClose, onCreate, leagueId }) => {
  const [name, setName] = useState('');
  const { createTeam, loading } = useApi();
  const { user } = useAuth();
  const toast = useToast();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name) {
      toast({
        title: 'Missing Field',
        description: 'Please enter a team name',
        status: 'error',
        duration: 3000,
        position: 'top'
      });
      return;
    }
    
    try {
      // Include leagueId when creating a team
      const newTeam = await createTeam({ 
        name, 
        owner: user.username,
        leagueId 
      });
      
      toast({
        title: 'Team Created',
        description: `${name} has been created successfully`,
        status: 'success',
        duration: 3000,
        position: 'top'
      });
      
      setName('');
      onClose();
      onCreate(newTeam);
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create team',
        status: 'error',
        duration: 3000,
        position: 'top'
      });
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay backdropFilter="blur(10px)" />
      <ModalContent bg="gray.800" color="white" borderRadius="lg">
        <ModalHeader borderBottomWidth="1px" borderColor="gray.700">Create New Team</ModalHeader>
        <ModalCloseButton />
        <form onSubmit={handleSubmit}>
          <ModalBody py={6}>
            <Text mb={4} color="gray.400">
              You're creating a team in this league. After creating a team, you'll be able to participate in the draft and compete against other teams.
            </Text>
            
            <FormControl mb={4} isRequired>
              <FormLabel fontWeight="bold">Team Name</FormLabel>
              <Input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter a cool team name"
                bg="gray.700"
                borderColor="gray.600"
                _hover={{ borderColor: "teal.300" }}
                _focus={{ borderColor: "teal.300", boxShadow: "0 0 0 1px teal.300" }}
              />
            </FormControl>
          </ModalBody>
          
          <ModalFooter borderTopWidth="1px" borderColor="gray.700">
            <Button variant="ghost" mr={3} onClick={onClose} _hover={{ bg: "whiteAlpha.100" }}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              colorScheme="teal" 
              isLoading={loading}
              leftIcon={<AddIcon />}
            >
              Create Team
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

const LeagueDetail = () => {
  const { id } = useParams();
  const { getLeagueById, getStandings, getMatchups, joinLeague, loading, error } = useApi();
  const [league, setLeague] = useState(null);
  const [standings, setStandings] = useState([]);
  const [matchups, setMatchups] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const { user } = useAuth();
  const { selectLeague } = useLeague();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  
  useEffect(() => {
    const fetchLeagueData = async () => {
      try {
        const data = await getLeagueById(id);
        setLeague(data);
        
        // Set this as the selected league in context
        selectLeague(data);
        
        // Get standings
        try {
          const standingsData = await getStandings();
          setStandings(standingsData);
        } catch (err) {
          console.error('Error fetching standings:', err);
        }
        
        // Get current week matchups
        try {
          const matchupsData = await getMatchups(currentWeek);
          setMatchups(matchupsData);
        } catch (err) {
          console.error('Error fetching matchups:', err);
        }
      } catch (error) {
        console.error('Error fetching league:', error);
      }
    };
    
    if (id) {
      fetchLeagueData();
    }
    
    // Cleanup function to clear selected league when leaving the page
    return () => {
      // Don't clear selected league when navigating to related pages
      // like matchups, standings, or draft
      const path = window.location.pathname;
      if (!path.includes('/matchups') && !path.includes('/standings') && !path.includes('/draft')) {
        selectLeague(null);
      }
    };
  }, [id, getLeagueById, getStandings, getMatchups, currentWeek, selectLeague]);

  const handleJoinLeague = async () => {
    if (!league) return;
    
    try {
      await joinLeague(league.id);
      
      // Refresh league data
      const updatedLeague = await getLeagueById(league.id);
      setLeague(updatedLeague);
      
      toast({
        title: 'Success!',
        description: `You've joined ${league.name}`,
        status: 'success',
        duration: 3000,
        position: 'top'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to join league',
        status: 'error',
        duration: 3000,
        position: 'top'
      });
    }
  };
  
  const handleCreateTeam = (newTeam) => {
    // Update league.teams if it exists
    if (league && league.teams) {
      setLeague({
        ...league,
        teams: [...league.teams, newTeam]
      });
    }
  };
  
  if (loading && !league) {
    return (
      <Flex justify="center" align="center" height="50vh">
        <Spinner 
          thickness="4px"
          speed="0.65s"
          emptyColor="gray.700"
          color="teal.500"
          size="xl"
        />
      </Flex>
    );
  }
  
  if (error || !league) {
    return (
      <Box p={6} bg="red.900" rounded="lg" borderWidth={1} borderColor="red.700">
        <Heading size="md" color="red.300" mb={2}>Error Loading League</Heading>
        <Text color="white">{error || 'League not found'}</Text>
      </Box>
    );
  }
  
  const isUserMember = league.memberIds?.includes(user.id);
  const userHasTeam = league.teams?.some(team => team.userId === user.id);
  
  // Simulated members data (would need to be provided from the API)
  const members = [
    { username: league.creatorId ? 'League Creator' : 'Admin', isCreator: true },
    ...(league.memberIds || [])
      .filter(id => id !== league.creatorId)
      .map(id => ({ username: `Member ${id.slice(0, 5)}` }))
  ];
  
  return (
    <Box>
      {/* League Header */}
      <Box 
        bg="gray.800" 
        p={6} 
        rounded="lg" 
        shadow="xl"
        borderWidth="1px"
        borderColor="gray.700"
        mb={8}
      >
        <Flex 
          justify="space-between" 
          align={{ base: "flex-start", md: "center" }}
          direction={{ base: "column", md: "row" }}
          gap={{ base: 4, md: 0 }}
        >
          <Box>
            <Heading size="xl" mb={2}>{league.name}</Heading>
            <Text color="gray.400">Created by {league.creatorId}</Text>
            {league.description && <Text mt={2}>{league.description}</Text>}
            
            {/* Display the regions */}
            {league.regions && league.regions.length > 0 && (
              <Box mt={3}>
                <Text fontWeight="semibold" mb={1}>Regions:</Text>
                <HStack spacing={2}>
                  {league.regions.map((region, idx) => (
                    <Badge key={idx} colorScheme="teal" fontSize="sm" px={2} py={1} borderRadius="full">
                      {region}
                    </Badge>
                  ))}
                </HStack>
              </Box>
            )}
          </Box>
          
          {!isUserMember ? (
            <Button 
              colorScheme="teal" 
              onClick={handleJoinLeague}
              leftIcon={<StarIcon />}
              size="lg"
            >
              Join League
            </Button>
          ) : !userHasTeam ? (
            <Button 
              colorScheme="teal" 
              onClick={onOpen}
              leftIcon={<AddIcon />}
              size="lg"
            >
              Create Team
            </Button>
          ) : (
            <Badge colorScheme="green" p={2} fontSize="md" rounded="md">
              <Flex align="center">
                <CheckIcon mr={2} />
                Member
              </Flex>
            </Badge>
          )}
        </Flex>
        
        <Grid templateColumns={{ base: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }} gap={4} mt={6}>
          <GridItem>
            <VStack align="flex-start" spacing={0}>
              <Text fontSize="sm" color="gray.400">Teams</Text>
              <Text fontWeight="bold" fontSize="xl" color="white">
                {league.teams?.length || 0}/{league.maxTeams || 10}
              </Text>
            </VStack>
          </GridItem>
          
          <GridItem>
            <VStack align="flex-start" spacing={0}>
              <Text fontSize="sm" color="gray.400">Members</Text>
              <Text fontWeight="bold" fontSize="xl" color="white">
                {league.memberIds?.length || 0}
              </Text>
            </VStack>
          </GridItem>
          
          <GridItem>
            <VStack align="flex-start" spacing={0}>
              <Text fontSize="sm" color="gray.400">Current Week</Text>
              <Text fontWeight="bold" fontSize="xl" color="white">
                {league.currentWeek || 0}
              </Text>
            </VStack>
          </GridItem>
          
          <GridItem>
            <VStack align="flex-start" spacing={0}>
              <Text fontSize="sm" color="gray.400">Visibility</Text>
              <Flex align="center">
                <Icon 
                  as={league.isPublic ? CheckIcon : WarningIcon} 
                  color={league.isPublic ? "green.400" : "orange.400"}
                  mr={1}
                />
                <Text fontWeight="bold" fontSize="md" color="white">
                  {league.isPublic ? "Public" : "Private"}
                </Text>
              </Flex>
            </VStack>
          </GridItem>
        </Grid>
      </Box>
      
      {/* League Content */}
      <Grid templateColumns={{ base: "1fr", lg: "3fr 1fr" }} gap={8}>
        <GridItem>
          <Tabs variant="soft-rounded" colorScheme="teal" isLazy>
            <TabList mb={8}>
              <Tab _selected={{ color: 'white', bg: 'teal.500' }} color="gray.300">Teams</Tab>
              <Tab _selected={{ color: 'white', bg: 'teal.500' }} color="gray.300">Standings</Tab>
              <Tab _selected={{ color: 'white', bg: 'teal.500' }} color="gray.300">Matchups</Tab>
              <Tab _selected={{ color: 'white', bg: 'teal.500' }} color="gray.300">Draft</Tab>
            </TabList>
            
            <TabPanels>
              <TabPanel px={0}>
                {league.teams && league.teams.length > 0 ? (
                  <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={6}>
                    {league.teams.map(team => (
                      <TeamCard key={team.id} team={team} />
                    ))}
                  </SimpleGrid>
                ) : (
                  <Box 
                    p={8} 
                    bg="gray.800" 
                    rounded="lg" 
                    textAlign="center"
                    borderWidth="1px"
                    borderColor="gray.700"
                    shadow="xl"
                  >
                    <Icon as={InfoIcon} boxSize={12} color="gray.400" mb={4} />
                    <Heading size="md" mb={2} fontWeight="bold" color="white">No Teams Yet</Heading>
                    <Text color="gray.300" mb={6}>Be the first to create a team in this league</Text>
                    {isUserMember && !userHasTeam && (
                      <Button 
                        colorScheme="teal" 
                        onClick={onOpen}
                        size="lg"
                        leftIcon={<AddIcon />}
                      >
                        Create First Team
                      </Button>
                    )}
                  </Box>
                )}
              </TabPanel>
              
              <TabPanel px={0}>
                <Box bg="gray.800" rounded="lg" overflow="hidden" borderWidth="1px" borderColor="gray.700">
                  <Table variant="simple">
                    <Thead bg="gray.900">
                      <Tr>
                        <Th color="gray.300">Rank</Th>
                        <Th color="gray.300">Team</Th>
                        <Th isNumeric color="gray.300">W</Th>
                        <Th isNumeric color="gray.300">L</Th>
                        <Th isNumeric color="gray.300">Points</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {standings.length > 0 ? (
                        standings.map((standing, index) => (
                          <Tr key={index} _hover={{ bg: "gray.700" }}>
                            <Td fontWeight="bold" color={index < 3 ? "teal.300" : "white"}>
                              {index + 1}
                            </Td>
                            <Td>
                              <Link as={RouterLink} to={`/teams/${standing.team.id}`} color="white" _hover={{ color: 'teal.300' }}>
                                {standing.team.name}
                              </Link>
                            </Td>
                            <Td isNumeric color="green.400">{standing.wins}</Td>
                            <Td isNumeric color="red.400">{standing.losses}</Td>
                            <Td isNumeric fontWeight="bold">{standing.totalPoints.toFixed(1)}</Td>
                          </Tr>
                        ))
                      ) : (
                        <Tr>
                          <Td colSpan={5} textAlign="center" py={8} color="gray.400">
                            No standings available yet
                          </Td>
                        </Tr>
                      )}
                    </Tbody>
                  </Table>
                </Box>
              </TabPanel>
              
              <TabPanel px={0}>
                <Box bg="gray.800" p={6} rounded="lg" borderWidth="1px" borderColor="gray.700">
                  <Flex justify="space-between" align="center" mb={6}>
                    <Text fontSize="xl" fontWeight="bold" color="white">Matchups for Week {currentWeek}</Text>
                    <HStack>
                      <Button 
                        size="sm" 
                        onClick={() => setCurrentWeek(prev => Math.max(1, prev - 1))}
                        isDisabled={currentWeek <= 1}
                        leftIcon={<TimeIcon />}
                        variant="ghost"
                        color="gray.300"
                        _hover={{ bg: 'whiteAlpha.200' }}
                      >
                        Previous
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => setCurrentWeek(prev => prev + 1)}
                        isDisabled={currentWeek >= (league.schedule?.length || 0)}
                        rightIcon={<TimeIcon />}
                        variant="ghost"
                        color="gray.300"
                        _hover={{ bg: 'whiteAlpha.200' }}
                      >
                        Next
                      </Button>
                    </HStack>
                  </Flex>
                  
                  {matchups.length > 0 ? (
                    <VStack spacing={4} align="stretch">
                      {matchups.map((matchup, i) => (
                        <Box 
                          key={i} 
                          p={4} 
                          bg="gray.700" 
                          rounded="md"
                          borderWidth="1px"
                          borderColor="gray.600"
                          shadow="md"
                          _hover={{ borderColor: 'teal.300', transform: 'translateY(-2px)' }}
                          transition="all 0.2s"
                        >
                          <Grid templateColumns="1fr auto 1fr" gap={4} alignItems="center">
                            <GridItem>
                              <VStack align="flex-start">
                                <Text fontWeight="bold" color="white">{matchup.homeTeam.name}</Text>
                                <Text fontSize="sm" color="gray.400">{matchup.homeTeam.owner}</Text>
                              </VStack>
                            </GridItem>
                            
                            <GridItem textAlign="center">
                              <Badge colorScheme={matchup.completed ? "green" : "gray"} p={2}>
                                {matchup.completed ? (
                                  <Text fontWeight="bold">
                                    {matchup.homeScore.toFixed(1)} - {matchup.awayScore.toFixed(1)}
                                  </Text>
                                ) : (
                                  <Flex align="center">
                                    <CalendarIcon mr={1} />
                                    <Text>Upcoming</Text>
                                  </Flex>
                                )}
                              </Badge>
                            </GridItem>
                            
                            <GridItem>
                              <VStack align="flex-end">
                                <Text fontWeight="bold" color="white">{matchup.awayTeam.name}</Text>
                                <Text fontSize="sm" color="gray.400">{matchup.awayTeam.owner}</Text>
                              </VStack>
                            </GridItem>
                          </Grid>
                        </Box>
                      ))}
                    </VStack>
                  ) : (
                    <Box textAlign="center" py={8} color="gray.400">
                      <CalendarIcon boxSize={10} mb={4} />
                      <Text>No matchups scheduled for this week</Text>
                    </Box>
                  )}
                </Box>
              </TabPanel>
              
              <TabPanel px={0}>
                <Box bg="gray.800" p={6} rounded="lg" borderWidth="1px" borderColor="gray.700">
                  <Flex direction="column" align="center" justify="center" py={8}>
                    <Icon as={CalendarIcon} boxSize={12} color="gray.500" mb={4} />
                    <Heading size="md" mb={3} color="white">Draft</Heading>
                    <Text color="gray.400" textAlign="center" maxW="md" mb={6}>
                      The draft for this league has not been scheduled yet. Once scheduled, you'll be able to participate here.
                    </Text>
                    {league.memberIds?.includes(user.id) && (
                      <Button colorScheme="teal" size="lg" as={RouterLink} to={`/draft?leagueId=${league.id}`}>
                        View Draft Details
                      </Button>
                    )}
                  </Flex>
                </Box>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </GridItem>
        
        {/* Sidebar */}
        <GridItem>
          <Box bg="gray.800" p={5} rounded="lg" borderWidth="1px" borderColor="gray.700">
            <Heading size="md" mb={4} color="white">League Members</Heading>
            <VStack spacing={3} align="stretch">
              {members.map((member, index) => (
                <Flex key={index} justify="space-between" align="center">
                  <Flex align="center">
                    <Avatar size="sm" name={member.username} mr={3} bg="teal.500" />
                    <Text fontWeight="medium" color="white">{member.username}</Text>
                  </Flex>
                  <Badge colorScheme={index === 0 ? "purple" : "gray"}>
                    {index === 0 ? "Creator" : "Member"}
                  </Badge>
                </Flex>
              ))}
            </VStack>
          </Box>
        </GridItem>
      </Grid>
      
      <CreateTeamModal 
        isOpen={isOpen} 
        onClose={onClose} 
        onCreate={handleCreateTeam}
        leagueId={league.id}
      />
    </Box>
  );
};

export default LeagueDetail;