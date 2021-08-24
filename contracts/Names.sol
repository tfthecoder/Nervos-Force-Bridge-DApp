pragma solidity >=0.8.0;

contract Names {
  uint storedData;
  mapping(uint => Name ) public names;
  uint public totalName;

  struct Name{
    uint id;
    string name;
  }
  constructor()  {
    totalName= 0;
  }
  
  function addName(string memory _name) public{
    totalName +=1;
    names[totalName] = Name(totalName,_name);
  }

}